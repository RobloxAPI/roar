package history

import (
	"time"

	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	"github.com/robloxapi/roar/id"
)

// Index of Update list.
type updateID = int

// Index of Change list.
type changeID = int

// Entrypoint to history structure.
type jRoot struct {
	// Objects per type.
	Object jObject
	// List of all changes.
	Change []jChange
	// List of all updates.
	Update []jUpdate
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
	// Maps type ID to references.
	Type map[id.Type][]jTypeRef
}

type jTypeRef struct {
	Change changeID
	Prev   bool
	Field  string
	Type   string
	Index  int
	Value  rbxdump.Type
}

// Represents one unit of change.
type jChange struct {
	// The index of the update in jRoot.Update that caused this change.
	Update updateID
	// The index of this change in Update.Changes.
	Index int
	// The change that occurred.
	Action diff.Action
	// The previous values before the change was made.
	Prev rbxdump.Fields `json:",omitempty"`
}

// Represents an update that caused a number of changes.
type jUpdate struct {
	// Time when the update occurred.
	Date time.Time
	// Version ID string (version-0123456789abcdef).
	GUID string
	// Version number.
	Version jVersion
	// Lower inclusive bound of changes that occurred during the update, as an
	// index of jRoot.Change.
	ChangesStart changeID
	// Number of changes that occurred during the update.
	ChangesCount changeID
}

// Version represents the version of a Roblox build.
type jVersion struct {
	Gen     int
	Version int
	Patch   int
	Commit  int
}
