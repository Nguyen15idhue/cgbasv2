package ntrip

import (
	"bufio"
	"encoding/base64"
	"fmt"
	"log"
	"net"
	"net/url"
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
	repo    *repository.MySQL
	config  models.NtripConfig
	stopCh  chan struct{}
	stopped bool
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
			log.Printf("[NTRIP:%s] Connection ended: %v", c.config.StationID, err)
			c.repo.InsertLog(c.config.StationID, "disconnect", err.Error())

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
				c.repo.InsertLog(c.config.StationID, "error", "all reconnect attempts failed")
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
	// Parse NTRIP URL
	parsedURL, err := url.Parse(c.config.NtripURL)
	if err != nil {
		return fmt.Errorf("parse URL: %w", err)
	}

	host := parsedURL.Hostname()
	port := parsedURL.Port()
	if port == "" {
		port = "2101"
	}

	addr := net.JoinHostPort(host, port)

	log.Printf("[NTRIP:%s] Connecting to %s...", c.config.StationID, addr)

	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	// Build NTRIP request
	var req strings.Builder
	req.WriteString(fmt.Sprintf("GET /%s HTTP/1.1\r\n", c.config.Mountpoint))
	req.WriteString(fmt.Sprintf("Host: %s\r\n", addr))
	req.WriteString("Ntrip-Version: NTRIP/2.0\r\n")
	req.WriteString("User-Agent: CGBAS-NTRIP-Client/1.0\r\n")

	if c.config.NtripUser != "" {
		cred := base64.StdEncoding.EncodeToString([]byte(c.config.NtripUser + ":" + c.config.NtripPass))
		req.WriteString(fmt.Sprintf("Authorization: Basic %s\r\n", cred))
	}

	req.WriteString("\r\n")

	// Send request
	_, err = conn.Write([]byte(req.String()))
	if err != nil {
		return fmt.Errorf("write request: %w", err)
	}

	// Read response with timeout
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	reader := bufio.NewReader(conn)

	// Read first line to check response
	firstLine, err := reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	firstLine = strings.TrimSpace(firstLine)
	log.Printf("[NTRIP:%s] Response: %s", c.config.StationID, firstLine)

	// Check for successful response (NTRIP uses "ICY 200 OK" or "HTTP/1.1 200 OK")
	if strings.Contains(firstLine, "200") || strings.Contains(firstLine, "ICY") {
		// Read remaining headers
		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				break
			}
			if strings.TrimSpace(line) == "" {
				break
			}
		}

		log.Printf("[NTRIP:%s] Connected to %s (mountpoint: %s)", c.config.StationID, c.config.NtripURL, c.config.Mountpoint)
		c.repo.InsertLog(c.config.StationID, "connect", fmt.Sprintf("connected to %s/%s", c.config.NtripURL, c.config.Mountpoint))

		c.updateStatus(c.config.StationID, statusOnline, 0, 0, 0, 0, 0)

		// Read data stream
		buf := make([]byte, 4096)
		lastDataTime := time.Now()

		for {
			select {
			case <-c.stopCh:
				c.repo.InsertLog(c.config.StationID, "disconnect", "client stopped")
				return nil
			default:
			}

			conn.SetReadDeadline(time.Now().Add(time.Duration(dataTimeout+5) * time.Second))
			n, err := reader.Read(buf)
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					log.Printf("[NTRIP:%s] Data timeout: no data for %ds", c.config.StationID, dataTimeout)
					c.repo.InsertLog(c.config.StationID, "timeout", fmt.Sprintf("no data for %ds", dataTimeout))
					c.updateStatus(c.config.StationID, statusNoData, 0, 0, 0, 0, 0)
					return fmt.Errorf("data timeout")
				}
				log.Printf("[NTRIP:%s] Read error: %v", c.config.StationID, err)
				c.updateStatus(c.config.StationID, statusOffline, 0, 0, 0, 0, 0)
				return fmt.Errorf("read error: %w", err)
			}

			if n > 0 {
				lastDataTime = time.Now()
				c.parseData(buf[:n])
			}

			_ = lastDataTime
		}
	}

	// Read remaining error response
	var errMsg strings.Builder
	errMsg.WriteString(firstLine)
	for {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		errMsg.WriteString("\n")
		errMsg.WriteString(strings.TrimSpace(line))
		if strings.TrimSpace(line) == "" {
			break
		}
	}

	return fmt.Errorf("server error: %s", errMsg.String())
}

func (c *Client) parseData(data []byte) {
	str := string(data)
	lines := strings.Split(str, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "$GPGGA") || strings.HasPrefix(line, "$GNGGA") {
			satR, satC, satE, satG := c.extractSatellites(line)
			c.updateStatus(c.config.StationID, statusOnline, 0, satR, satC, satE, satG)
			log.Printf("[NTRIP:%s] Satellites - GPS:%d GLONASS:%d Galileo:%d BeiDou:%d", c.config.StationID, satG, satR, satE, satC)
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
