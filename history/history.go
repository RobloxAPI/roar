// Provides structure for API dump history.
package history

import (
	"encoding/json"
	"slices"
	"sort"
	"time"

	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	"github.com/robloxapi/rbxver"
	"github.com/robloxapi/roar/archive"
	"github.com/robloxapi/roar/id"
)

// Maps an object to a list of changes that apply to the object.
type Object struct {
	// Maps class ID to changes.
	Class map[id.Class][]*Change
	// Maps member ID to changes.
	Member map[id.MemberID][]*Change
	// Maps enum ID to changes.
	Enum map[id.Enum][]*Change
	// Maps enum item ID to changes.
	EnumItem map[id.EnumItemID][]*Change
	// Maps type ID to type references.
	Type map[id.Type][]*TypeRef
}

// Represents one unit of change.
type Change struct {
	// The index of the event in Root.Event that caused this change.
	Event *Event
	// The change that occurred.
	Action diff.Action
	// The previous values before the change was made.
	Prev rbxdump.Fields
}

// Represents an event that caused a number of changes.
type Event struct {
	// The previous event, from which this event's changes were based on. May be
	// nil.
	Prev *Event
	// The next event. May be nil.
	Next *Event
	// Time when the event occurred.
	Date time.Time
	// Version ID string (version-0123456789abcdef).
	GUID string
	// Version number.
	Version rbxver.Version
	// List of changes that occurred during the event.
	Changes []*Change
}

// Refers to a Type that appears within a Change.
type TypeRef struct {
	Change *Change      // The associated change.
	Prev   bool         // true: Change.Prev; false: Change.Action.Fields.
	Field  string       // Index of Fields.
	Type   string       // Type: rbxdump.Type; Parameter: rbxdump.Parameter.
	Index  int          // Index within slice value. -1: Not a slice.
	Value  rbxdump.Type // The type itself.
}

// Entrypoint to history structure.
type Root struct {
	// Objects per type.
	Object Object
	// List of all changes.
	Change []*Change
	// List of all events.
	Event []*Event
}

// Returns a new Root with initialized fields.
func NewRoot() *Root {
	return &Root{
		Object: Object{
			Class:    map[id.Class][]*Change{},
			Member:   map[id.MemberID][]*Change{},
			Enum:     map[id.Enum][]*Change{},
			EnumItem: map[id.EnumItemID][]*Change{},
			Type:     map[id.Type][]*TypeRef{},
		},
	}
}

func (r *Root) UnmarshalJSON(b []byte) error {
	var jr jRoot
	if err := json.Unmarshal(b, &jr); err != nil {
		return err
	}

	r.Change = make([]*Change, len(jr.Change))
	for cid, jchange := range jr.Change {
		r.Change[cid] = &Change{
			Action: jchange.Action,
			Prev:   jchange.Prev,
		}
	}

	r.Event = make([]*Event, len(jr.Event))
	for id, jevent := range jr.Event {
		event := &Event{
			Date: jevent.Date,
			GUID: jevent.GUID,
			Version: rbxver.Version{
				Generation: jevent.Version.Gen,
				Version:    jevent.Version.Version,
				Patch:      jevent.Version.Patch,
				Commit:     jevent.Version.Commit,
			},
			Changes: make([]*Change, jevent.ChangesCount),
		}
		for i := range event.Changes {
			cid := jevent.ChangesStart + i
			change := r.Change[cid]
			change.Event = event
			event.Changes[i] = change
		}
		r.Event[id] = event
	}
	for id := 1; id < len(r.Event); id++ {
		r.Event[id].Prev = r.Event[id-1]
	}
	for id := 0; id < len(r.Event)-1; id++ {
		r.Event[id].Next = r.Event[id+1]
	}

	r.Object.Class = make(map[id.Class][]*Change, len(jr.Object.Class))
	r.Object.Member = make(map[id.MemberID][]*Change)
	r.Object.Enum = make(map[id.Enum][]*Change, len(jr.Object.Enum))
	r.Object.EnumItem = make(map[id.EnumItemID][]*Change)
	r.Object.Type = make(map[id.Type][]*TypeRef)

	for class, changes := range jr.Object.Class {
		r.Object.Class[class] = r.decodeChanges(changes)
	}
	for class, members := range jr.Object.Member {
		for member, changes := range members {
			r.Object.Member[id.MemberID{class, member}] = r.decodeChanges(changes)
		}
	}
	for enum, changes := range jr.Object.Enum {
		r.Object.Enum[enum] = r.decodeChanges(changes)
	}
	for enum, items := range jr.Object.EnumItem {
		for item, changes := range items {
			r.Object.EnumItem[id.EnumItemID{enum, item}] = r.decodeChanges(changes)
		}
	}
	for typ, refs := range jr.Object.Type {
		r.Object.Type[typ] = r.decodeTypeRefs(refs)
	}

	return nil
}

func (r *Root) decodeChanges(cids []changeID) []*Change {
	changes := make([]*Change, len(cids))
	for i, cid := range cids {
		changes[i] = r.Change[cid]
	}
	return changes
}

func (r *Root) decodeTypeRefs(jrefs []jTypeRef) []*TypeRef {
	refs := make([]*TypeRef, len(jrefs))
	for i, jref := range jrefs {
		refs[i] = &TypeRef{
			Change: r.Change[jref.Change],
			Prev:   jref.Prev,
			Field:  jref.Field,
			Type:   jref.Type,
			Index:  jref.Index,
			Value:  jref.Value,
		}
	}
	return refs
}

func (r *Root) MarshalJSON() (b []byte, err error) {
	var jr jRoot
	changes := make(map[*Change]changeID, len(r.Change))
	for cid, change := range r.Change {
		changes[change] = cid
	}

	jr.Change = make([]jChange, 0, len(r.Change))
	jr.Event = make([]jEvent, len(r.Event))
	for eid, event := range r.Event {
		jevent := jEvent{
			Date: event.Date,
			GUID: event.GUID,
			Version: jVersion{
				Gen:     event.Version.Generation,
				Version: event.Version.Version,
				Patch:   event.Version.Patch,
				Commit:  event.Version.Commit,
			},
			ChangesStart: len(jr.Change),
			ChangesCount: len(event.Changes),
		}
		for index, change := range event.Changes {
			jr.Change = append(jr.Change, jChange{
				Event:  eid,
				Index:  index,
				Action: change.Action,
				Prev:   change.Prev,
			})
		}
		jr.Event[eid] = jevent
	}

	jr.Object.Class = make(map[id.Class][]changeID, len(r.Object.Class))
	jr.Object.Member = make(map[id.Class]map[id.Member][]changeID)
	jr.Object.Enum = make(map[id.Enum][]changeID, len(r.Object.Enum))
	jr.Object.EnumItem = make(map[id.Enum]map[id.EnumItem][]changeID)
	jr.Object.Type = make(map[id.Type][]jTypeRef, len(r.Object.Type))

	for class, list := range r.Object.Class {
		jr.Object.Class[class] = r.encodeChanges(changes, list)
	}
	for memberID, list := range r.Object.Member {
		members := jr.Object.Member[memberID.Class]
		if members == nil {
			members = make(map[id.Member][]changeID)
			jr.Object.Member[memberID.Class] = members
		}
		members[memberID.Member] = r.encodeChanges(changes, list)
	}
	for enum, list := range r.Object.Enum {
		jr.Object.Enum[enum] = r.encodeChanges(changes, list)
	}
	for enumItemID, list := range r.Object.EnumItem {
		items := jr.Object.EnumItem[enumItemID.Enum]
		if items == nil {
			items = make(map[id.EnumItem][]changeID)
			jr.Object.EnumItem[enumItemID.Enum] = items
		}
		items[enumItemID.EnumItem] = r.encodeChanges(changes, list)
	}
	for typ, list := range r.Object.Type {
		jr.Object.Type[typ] = r.encodeTypeRefs(changes, list)
	}

	return json.Marshal(jr)
}

func (r *Root) encodeChanges(changes map[*Change]changeID, list []*Change) []changeID {
	cids := make([]changeID, len(list))
	for i, change := range list {
		cids[i] = changes[change]
	}
	return cids
}

func (r *Root) encodeTypeRefs(changes map[*Change]changeID, refs []*TypeRef) []jTypeRef {
	jrefs := make([]jTypeRef, len(refs))
	for i, ref := range refs {
		jrefs[i] = jTypeRef{
			Change: changes[ref.Change],
			Prev:   ref.Prev,
			Field:  ref.Field,
			Type:   ref.Type,
			Index:  ref.Index,
			Value:  ref.Value,
		}
	}
	return jrefs
}

// Returns an ordered list of events occurring after or at start and ending
// before end. If an endpoint is zero, then it is not compared. If both are
// zero, then all events are returned.
func (r Root) EventRange(start, end time.Time) (events []*Event) {
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
func (r Root) EarliestEvent() (event *Event) {
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
func (r Root) LatestEvent() (event *Event) {
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
func SortChanges(changes []*Change) {
	sort.SliceStable(changes, func(i, j int) bool {
		return changes[i].Event.Date.Before(changes[j].Event.Date)
	})
}

// Returns the changes of an event as a list of actions.
func Actions(event *Event) []diff.Action {
	actions := make([]diff.Action, len(event.Changes))
	for i, change := range event.Changes {
		actions[i] = change.Action
	}
	return actions
}

// Returns a map of entries in values filtered to include only keys from keys.
func filterFields(keys, values rbxdump.Fields) rbxdump.Fields {
	result := make(rbxdump.Fields, len(keys))
	for key := range keys {
		result[key] = values[key]
	}
	return result
}

// Appends an event derived from the given build and actions. The latest event
// is assumed to be the previous.
//
// All maps in the Root are expected to be non-nil.
func (r *Root) AppendEvent(build archive.Build, actions []diff.Action, prevRoot *rbxdump.Root) {
	build.Version.Format = rbxver.Dot
	var prev *Event
	if len(r.Event) > 0 {
		prev = r.Event[len(r.Event)-1]
	}
	event := Event{
		Prev:    prev,
		Date:    build.Date,
		GUID:    build.GUID,
		Version: build.Version,
		Changes: make([]*Change, 0, len(actions)),
	}
	var inverse []diff.Action
	if prevRoot != nil {
		inverse = (diff.Patch{Root: prevRoot}).Inverse(actions)
	}
	for i, action := range actions {
		change := Change{
			Event:  &event,
			Action: action,
		}
		if prevRoot != nil {
			change.Prev = inverse[i].Fields
		}
		r.Change = append(r.Change, &change)
		event.Changes = append(event.Changes, &change)

		switch action.Element {
		case diff.Class:
			r.Object.Class[action.Primary] = append(r.Object.Class[action.Primary], &change)
			// Removal of primary element is relevant to each secondary element.
			if prevRoot != nil && action.Type == diff.Remove {
				if class := prevRoot.Classes[action.Primary]; class != nil {
					for member := range class.Members {
						i := id.MemberID{action.Primary, member}
						r.Object.Member[i] = append(r.Object.Member[i], &change)
					}
				}
			}
		case diff.Property,
			diff.Function,
			diff.Event,
			diff.Callback:
			member := id.MemberID{action.Primary, action.Secondary}
			r.Object.Member[member] = append(r.Object.Member[member], &change)
		case diff.Enum:
			if r.Object.Enum == nil {
				r.Object.Enum = map[id.Enum][]*Change{}
			}
			r.Object.Enum[action.Primary] = append(r.Object.Enum[action.Primary], &change)
			// Removal of primary element is relevant to each secondary element.
			if prevRoot != nil && action.Type == diff.Remove {
				if enum := prevRoot.Enums[action.Primary]; enum != nil {
					for item := range enum.Items {
						i := id.EnumItemID{action.Primary, item}
						r.Object.EnumItem[i] = append(r.Object.EnumItem[i], &change)
					}
				}
			}
		case diff.EnumItem:
			item := id.EnumItemID{action.Primary, action.Secondary}
			r.Object.EnumItem[item] = append(r.Object.EnumItem[item], &change)
		}

		// Add a reference for each type found in the change.
		for name, value := range change.Prev {
			r.addTypeRefs(value, TypeRef{
				Change: &change,
				Prev:   true,
				Field:  name,
				Type:   "Type",
				Index:  -1,
			})
		}
		for name, value := range change.Action.Fields {
			r.addTypeRefs(value, TypeRef{
				Change: &change,
				Prev:   false,
				Field:  name,
				Type:   "Type",
				Index:  -1,
			})
		}
	}
	r.Event = append(r.Event, &event)
	if prev != nil {
		prev.Next = &event
	}
}

// Called recursively for non-Types that contain a Type.
func (r *Root) addTypeRefs(value any, ref TypeRef) {
	switch value := value.(type) {
	case rbxdump.Type:
		switch value.Category {
		case "Class", "Enum":
			return
		}
		if r.Object.Type == nil {
			r.Object.Type = map[id.Type][]*TypeRef{}
		}
		ref.Value = value
		r.Object.Type[value.Name] = append(r.Object.Type[value.Name], &ref)
	case []rbxdump.Type:
		ref.Type = "Type"
		for i, value := range value {
			ref.Index = i
			r.addTypeRefs(value, ref)
		}
	case []rbxdump.Parameter:
		ref.Type = "Parameter"
		for i, value := range value {
			ref.Index = i
			r.addTypeRefs(value.Type, ref)
		}
	case rbxdump.Parameter:
		ref.Type = "Parameter"
		r.addTypeRefs(value.Type, ref)
	}
}

// Uses an event chain to generate an in-place API dump.
type Cursor struct {
	Target *Event
	Dump   *rbxdump.Root
}

// Rolls the cursor's current target forward or backward until it hits target.
// Returns false if target is nil, or target is not in the chain of c.Target. If
// c.Target is nil, the cursor rolls from the start of target's chain, until it
// reaches target. If true is returned, then c.Dump has been patched to
// represent the state of the target event.
func (c *Cursor) Roll(target *Event) bool {
	if target == nil {
		return false
	}
	if target == c.Target {
		return true
	}

	var direction int
	var start *Event
	if c.Target == nil {
		// Begin at start of chain, rolling forward until target.
		direction = 1
		start = target
		for prev := target.Prev; prev != nil; prev = prev.Prev {
			start = prev
		}
		// Produce dump of start.
		c.Dump = &rbxdump.Root{}
		patcher := diff.Patch{Root: c.Dump}
		for _, change := range start.Changes {
			actions := [1]diff.Action{change.Action}
			patcher.Patch(actions[:])
		}
		c.Target = start
		if target == c.Target {
			return true
		}
	} else {
		for next := c.Target.Next; next != nil; next = next.Next {
			if next == target {
				// Begin at current, rolling forward until target.
				direction = 1
				start = c.Target.Next
				goto roll
			}
		}
		for prev := c.Target.Prev; prev != nil; prev = prev.Prev {
			if prev == target {
				// Begin at current, rolling backward until target.
				direction = -1
				start = c.Target.Prev
				goto roll
			}
		}
	}
roll:
	patcher := diff.Patch{Root: c.Dump}
	switch direction {
	case 1:
		for event := start; ; event = event.Next {
			for _, change := range event.Changes {
				actions := [1]diff.Action{change.Action}
				patcher.Patch(actions[:])
			}
			c.Target = event
			if event == target {
				break
			}
		}
		return true
	case -1:
		for event := start; ; event = event.Prev {
			for _, change := range event.Changes {
				actions := [1]diff.Action{change.Action}
				actions[0].Type = -actions[0].Type
				actions[0].Fields = change.Prev
				patcher.Patch(actions[:])
			}
			c.Target = event
			if event == target {
				break
			}
		}
		return true
	default:
		// target is not in chain of c.Target.
		return false
	}
}

// Visits tags within a history.Root. If ok is true, then the tag will be
// updated to next.
func VisitTags(hist *Root, visit func(tag string) (next string, ok bool)) {
	for _, change := range hist.Change {
		visitFieldTags(change.Action.Fields, visit)
		visitFieldTags(change.Prev, visit)
	}
}

// Visits tags within an rbxdump.Fields.
func visitFieldTags(fields rbxdump.Fields, visit func(string) (string, bool)) {
	switch tags := fields["Tags"].(type) {
	case []string:
		for i, tag := range tags {
			if t, ok := visit(tag); ok {
				tags[i] = t
			}
		}
	case rbxdump.Tags:
		for i, tag := range tags {
			if t, ok := visit(tag); ok {
				tags[i] = t
			}
		}
	}
	if tag, ok := fields["Security"].(string); ok {
		if t, ok := visit(tag); ok {
			fields["Security"] = t
		}
	}
	if tag, ok := fields["ReadSecurity"].(string); ok {
		if t, ok := visit(tag); ok {
			fields["ReadSecurity"] = t
		}
	}
	if tag, ok := fields["WriteSecurity"].(string); ok {
		if t, ok := visit(tag); ok {
			fields["WriteSecurity"] = t
		}
	}
}
