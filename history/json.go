package history

import (
	"time"

	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	"github.com/robloxapi/rbxver"
	"github.com/robloxapi/roar/id"
)

// Index of Event list.
type eventID = int

// Index of Change list.
type changeID = int

// Entrypoint to history structure.
type jRoot struct {
	// Objects per type.
	Object jObject
	// List of all changes.
	Change []jChange
	// List of all events.
	Event []jEvent
}

// Maps an object to a list of changes that apply to the object.
type jObject struct {
	// Maps class ID to changes.
	Class map[id.Class][]changeID
	// Maps member ID to changes.
	Member map[id.Class]map[id.Member][]changeID
	// Maps enum ID to changes.
	Enum map[id.Enum][]changeID
	// Maps enum item ID to changes.
	EnumItem map[id.Enum]map[id.EnumItem][]changeID
	// Maps type ID to changes.
	Type map[id.Type][]changeID
}

// Represents one unit of change.
type jChange struct {
	// The index of the event in jRoot.Event that caused this change.
	Event eventID
	// The index of this change in Event.Changes.
	Index int
	// The change that occurred.
	Action diff.Action
	// The previous values before the change was made.
	Prev rbxdump.Fields `json:",omitempty"`
}

// Represents an event that caused a number of changes.
type jEvent struct {
	// Time when the event occurred.
	Date time.Time
	// Version ID string (version-0123456789abcdef).
	GUID string
	// Version number.
	Version rbxver.Version
	// Lower inclusive bound of changes that occurred during the event, as an
	// index of jRoot.Change.
	ChangesStart changeID
	// Number of changes that occurred during the event.
	ChangesCount changeID
}
