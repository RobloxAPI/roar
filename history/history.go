// Provides structure for API dump history.
package history

import (
	"slices"
	"sort"
	"time"

	"github.com/robloxapi/rbxdump/diff"
	"github.com/robloxapi/rbxver"
	"github.com/robloxapi/roar/id"
)

// Index of Event list.
type EventID = int

// Index of Change list.
type ChangeID = int

// Entrypoint to history structure.
type Root struct {
	// Objects per type.
	Object Object `json:"object"`
	// List of all changes.
	Change []Change `json:"change"`
	// List of all events.
	Event []Event `json:"event"`
}

// Returns an ordered list of events occurring after or at start and ending
// before end. If an endpoint is zero, then it is not compared. If both are
// zero, then all events are returned.
func (r Root) EventRange(start, end time.Time) (events []Event) {
	if start.IsZero() {
		if end.IsZero() {
			events = slices.Clone(r.Event)
		} else {
			for _, event := range r.Event {
				if event.Date.Compare(end) < 0 {
					events = append(events, event)
				}
			}
		}
	} else {
		if end.IsZero() {
			for _, event := range r.Event {
				if start.Compare(event.Date) <= 0 {
					events = append(events, event)
				}
			}
		} else {
			for _, event := range r.Event {
				if start.Compare(event.Date) <= 0 && event.Date.Compare(end) < 0 {
					events = append(events, event)
				}
			}
		}
	}
	sort.SliceStable(events, func(i, j int) bool {
		return events[i].Date.Before(events[j].Date)
	})
	return events
}

// Returns the earliest event, or zero if there are no events.
func (r Root) EarliestEvent() (event Event) {
	if len(r.Event) == 0 {
		return event
	}
	event = r.Event[0]
	for i := 1; i < len(r.Event); i++ {
		if r.Event[i].Date.Before(event.Date) {
			event = r.Event[i]
		}
	}
	return event
}

// Returns the latest event, or zero if there are no events.
func (r Root) LatestEvent() (event Event) {
	if len(r.Event) == 0 {
		return event
	}
	event = r.Event[0]
	for i := 1; i < len(r.Event); i++ {
		if r.Event[i].Date.After(event.Date) {
			event = r.Event[i]
		}
	}
	return event
}

// Sorts a list of change IDs by the corresponding date.
func (r Root) SortChanges(changes []ChangeID) {
	sort.SliceStable(changes, func(i, j int) bool {
		ci := r.Change[changes[i]]
		cj := r.Change[changes[j]]
		ei := r.Event[ci.Event]
		ej := r.Event[cj.Event]
		return ei.Date.Before(ej.Date)
	})
}

// Maps an object to a list of changes that apply to the object.
type Object struct {
	// Maps class ID to changes.
	Class map[id.Class][]ChangeID `json:"class"`
	// Maps member ID to changes.
	Member map[id.Class]map[id.Member][]ChangeID `json:"member"`
	// Maps enum ID to changes.
	Enum map[id.Enum][]ChangeID `json:"enum"`
	// Maps enum item ID to changes.
	EnumItem map[id.Enum]map[id.EnumItem][]ChangeID `json:"enumItem"`
	// Maps type ID to changes.
	Type map[id.Type][]ChangeID `json:"type"`
}

// Represents one unit of change.
type Change struct {
	// The index of the event in Root.Event that caused this change.
	Event EventID `json:"event"`
	// The index of this change in Event.Changes.
	Index int `json:"index"`
	// The change that occurred.
	Action diff.Action `json:"action"`
}

// Represents an event that caused a number of changes.
type Event struct {
	// Time when the event occurred.
	Date time.Time `json:"date"`
	// Version ID string (version-0123456789abcdef).
	GUID string `json:"guid"`
	// Version number.
	Version rbxver.Version `json:"version"`
	// List of changes that occurred during the event. Index of Root.Change.
	Changes []ChangeID `json:"changes"`
}
