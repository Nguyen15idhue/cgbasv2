package ntrip

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"ntripclient/models"
	"ntripclient/repository"
)

const (
	statusOnline  = 1
	statusNoData  = 2
	statusOffline = 3
)

type Client struct {
	repo     *repository.MySQL
	config   models.NtripConfig
	stopCh   chan struct{}
	stopped  bool
}

func NewClient(repo *repository.MySQL, cfg models.NtripConfig) *Client {
	return &Client{
		repo:   repo,
		config: cfg,
		stopCh: make(chan struct{}),
	}
}

func (c *Client) Stop() {
	if !c.stopped {
		c.stopped = true
		close(c.stopCh)
	}
}

func (c *Client) Run(dataTimeout int, reconnectDelay int) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[NTRIP:%s] Panic recovered: %v", c.config.StationID, r)
		}
	}()

	for {
		select {
		case <-c.stopCh:
			log.Printf("[NTRIP:%s] Stopped", c.config.StationID)
			return
		default:
		}

		err := c.connect(dataTimeout)
		if err != nil {
			log.Printf("[NTRIP:%s] Connection error: %v", c.config.StationID, err)
			c.repo.InsertLog(c.config.StationID, "error", err.Error())

			for attempt := 1; attempt <= 5; attempt++ {
				select {
				case <-c.stopCh:
					return
				case <-time.After(time.Duration(reconnectDelay) * time.Second):
				}

				log.Printf("[NTRIP:%s] Reconnect attempt %d/5", c.config.StationID, attempt)
				c.repo.InsertLog(c.config.StationID, "reconnect", fmt.Sprintf("attempt %d/5", attempt))

				err = c.connect(dataTimeout)
				if err == nil {
					break
				}
				log.Printf("[NTRIP:%s] Reconnect attempt %d failed: %v", c.config.StationID, attempt, err)
			}

			if err != nil {
				log.Printf("[NTRIP:%s] All reconnect attempts failed, retrying in 60s", c.config.StationID)
				c.repo.InsertLog(c.config.StationID, "disconnect", "all reconnect attempts failed")
				select {
				case <-c.stopCh:
					return
				case <-time.After(60 * time.Second):
				}
			}
		}
	}
}

func (c *Client) connect(dataTimeout int) error {
	url := fmt.Sprintf("%s/%s", strings.TrimRight(c.config.NtripURL, "/"), c.config.Mountpoint)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}

	req.Header.Set("Ntrip-Version", "NTRIP/2.0")
	req.Header.Set("User-Agent", "CGBAS-NTRIP-Client/1.0")

	if c.config.NtripUser != "" {
		req.SetBasicAuth(c.config.NtripUser, c.config.NtripPass)
	}

	client := &http.Client{Timeout: 0}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	log.Printf("[NTRIP:%s] Connected to %s", c.config.StationID, c.config.NtripURL)
	c.repo.InsertLog(c.config.StationID, "connect", fmt.Sprintf("connected to %s", c.config.NtripURL))

	lastDataTime := time.Now()
	connected := true

	c.updateStatus(c.config.StationID, statusOnline, 0, 0, 0, 0, 0)

	reader := bufio.NewReader(resp.Body)
	buf := make([]byte, 4096)

	for {
		select {
		case <-c.stopCh:
			c.repo.InsertLog(c.config.StationID, "disconnect", "client stopped")
			return nil
		default:
		}

		n, err := reader.Read(buf)
		if err != nil {
			if err == io.EOF {
				log.Printf("[NTRIP:%s] Stream ended", c.config.StationID)
			} else {
				log.Printf("[NTRIP:%s] Read error: %v", c.config.StationID, err)
			}
			connected = false
			break
		}

		if n > 0 {
			lastDataTime = time.Now()
			connected = true
			c.parseData(buf[:n])
		}

		if time.Since(lastDataTime) > time.Duration(dataTimeout)*time.Second {
			log.Printf("[NTRIP:%s] Data timeout", c.config.StationID)
			c.repo.InsertLog(c.config.StationID, "timeout", fmt.Sprintf("no data for %ds", dataTimeout))
			connected = false
			break
		}
	}

	if connected {
		c.updateStatus(c.config.StationID, statusOnline, 0, 0, 0, 0, 0)
	} else {
		c.updateStatus(c.config.StationID, statusOffline, 0, 0, 0, 0, 0)
	}

	return fmt.Errorf("connection lost")
}

var (
	gpggaRe = regexp.MustCompile(`^\$G[PNL][GA][GA],\d{6}[^*]*\*(?:[0-9A-Fa-f]{2})`)
	satRe   = regexp.MustCompile(`,(\d+),(\d+),(\d+),(\d+),`)
)

func (c *Client) parseData(data []byte) {
	str := string(data)
	lines := strings.Split(str, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "$GPGGA") || strings.HasPrefix(line, "$GNGGA") {
			satR, satC, satE, satG := c.extractSatellites(line)
			c.updateStatus(c.config.StationID, statusOnline, 0, satR, satC, satE, satG)
		}
	}
}

func (c *Client) extractSatellites(line string) (int, int, int, int) {
	parts := strings.Split(line, ",")
	if len(parts) < 8 {
		return 0, 0, 0, 0
	}

	totalSat := 0
	if s, err := strconv.Atoi(parts[7]); err == nil {
		totalSat = s
	}

	gps := totalSat / 4
	glonass := totalSat / 4
	galileo := totalSat / 4
	beidou := totalSat - gps - glonass - galileo

	return glonass, beidou, galileo, gps
}

func (c *Client) updateStatus(stationID string, connectStatus, delay, satR, satC, satE, satG int) {
	info := models.DynamicInfo{
		StationID:     stationID,
		ConnectStatus: connectStatus,
		Delay:         delay,
		SatR:          satR,
		SatC:          satC,
		SatE:          satE,
		SatG:          satG,
		UpdateTime:    time.Now().Unix(),
	}

	if err := c.repo.UpsertDynamicInfo(info); err != nil {
		log.Printf("[NTRIP:%s] Failed to update status: %v", stationID, err)
	}
}
