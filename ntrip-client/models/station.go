package models

type NtripConfig struct {
	StationID       string
	NtripURL        string
	Mountpoint      string
	NtripUser       string
	NtripPass       string
	IntervalSeconds int
	IsActive        bool
}
