package models

import "time"

type DynamicInfo struct {
	StationID          string
	ConnectStatus      int
	Delay              int
	SatR, SatC, SatE, SatG int
	UpdateTime         int64
	FirstOfflineAt     *time.Time
	OfflineDurationSec int
}
