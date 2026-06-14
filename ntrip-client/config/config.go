package config

import (
	"os"
	"strconv"
)

type Config struct {
	DBHost     string
	DBPort     int
	DBName     string
	DBUser     string
	DBPass     string
	ListenAddr string

	NTRIPPollInterval   int
	NTRIPReconnectDelay int
	NTRIPDataTimeout    int
}

func Load() *Config {
	return &Config{
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBPort:             getEnvInt("DB_PORT", 3306),
		DBName:             getEnv("DB_NAME", "cgbas_db"),
		DBUser:             getEnv("DB_USER", "cgbas"),
		DBPass:             getEnv("DB_PASS", ""),
		ListenAddr:         getEnv("LISTEN_ADDR", ":8080"),
		NTRIPPollInterval:  getEnvInt("NTRIP_POLL_INTERVAL", 5),
		NTRIPReconnectDelay: getEnvInt("NTRIP_RECONNECT_DELAY", 30),
		NTRIPDataTimeout:   getEnvInt("NTRIP_DATA_TIMEOUT", 30),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
