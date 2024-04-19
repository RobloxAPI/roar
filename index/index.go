// Provides structure for the primary API data index.
package index

import (
	"fmt"
	"slices"
	"sort"

	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/rbxdump/diff"
	"github.com/robloxapi/roar/history"
	"github.com/robloxapi/roar/id"
)

type Root struct {
	RootClasses    []id.Class
	MemberTypes    []id.MemberType
	TypeCategories []string

	Class    map[id.Class]*Class
	Member   map[id.Class]map[id.Member]*Member
	Enum     map[id.Enum]*Enum
	EnumItem map[id.Enum]map[id.EnumItem]*EnumItem
	Type     map[id.Type]*Type

	MinYear int
	MaxYear int
}

type Class struct {
	Name         string
	Removed      bool       // Not present in latest state.
	HasRemoved   bool       // Has removed descendant class.
	Subclasses   []id.Class // Sorted by name.
	Superclasses []id.Class // Sorted by ancestry.
	Related      TypeRefs   `json:",omitempty"`
}

type Member struct {
	Class   string
	Name    string
	Removed bool
	Related TypeRefs `json:",omitempty"`
}

type Enum struct {
	Name         string
	Removed      bool
	ItemsByValue []id.EnumItem
	ItemsByIndex []id.EnumItem
	Related      TypeRefs `json:",omitempty"`
}

type EnumItem struct {
	Enum    string
	Name    string
	Removed bool
}

type Type struct {
	Category string
	Name     string
	Removed  bool
	Related  TypeRefs `json:",omitempty"`
}

func (r *Root) Build(hist *history.Root, dump *rbxdump.Root) error {
	r.MemberTypes = slices.Clone(MemberTypes)

	if earliest := hist.EarliestEvent(); earliest != nil {
		r.MinYear = earliest.Date.Year()
	}
	if latest := hist.LatestEvent(); latest != nil {
		r.MaxYear = latest.Date.Year()
	}

	r.Class = map[id.Class]*Class{}
	for i, changes := range hist.Object.Class {
		class := Class{Name: i, Removed: true}
		for _, change := range changes {
			switch change.Action.Type {
			case diff.Add:
				class.Removed = false
			case diff.Remove:
				class.Removed = true
			}
		}

		r.Class[i] = &class
	}

	r.Member = map[id.Class]map[id.Member]*Member{}
	for i, changes := range hist.Object.Member {
		member := Member{Class: i.Class, Name: i.Member, Removed: true}
		for _, change := range changes {
			switch change.Action.Type {
			case diff.Add:
				member.Removed = false
			case diff.Remove:
				member.Removed = true
			}
		}

		members := r.Member[i.Class]
		if members == nil {
			members = map[id.Member]*Member{}
			r.Member[i.Class] = members
		}
		members[i.Member] = &member
	}

	r.Enum = map[id.Enum]*Enum{}
	for i, changes := range hist.Object.Enum {
		enum := Enum{Name: i, Removed: true}
		for _, change := range changes {
			switch change.Action.Type {
			case diff.Add:
				enum.Removed = false
			case diff.Remove:
				enum.Removed = true
			}
		}

		r.Enum[i] = &enum
	}

	r.EnumItem = map[id.Enum]map[id.EnumItem]*EnumItem{}
	for i, changes := range hist.Object.EnumItem {
		item := EnumItem{Enum: i.Enum, Name: i.EnumItem, Removed: true}
		for _, change := range changes {
			switch change.Action.Type {
			case diff.Add:
				item.Removed = false
			case diff.Remove:
				item.Removed = true
			}
		}

		items := r.EnumItem[i.Enum]
		if items == nil {
			items = map[id.EnumItem]*EnumItem{}
			r.EnumItem[i.Enum] = items
		}
		items[i.EnumItem] = &item
	}

	cats := map[string]struct{}{}
	r.Type = map[id.Type]*Type{}
	for i, refs := range hist.Object.Type {
		typ := Type{Name: i, Removed: true}
		for _, ref := range refs {
			if ref.Value.Category != typ.Category && typ.Category != "" {
				fmt.Printf("CHECK: type %s has category %s and %s\n", i, typ.Category, ref.Value.Category)
			} else {
				typ.Category = ref.Value.Category
				cats[typ.Category] = struct{}{}
			}
		}
		r.Type[i] = &typ
	}

	r.TypeCategories = make([]string, 0, len(cats))
	for cat := range cats {
		r.TypeCategories = append(r.TypeCategories, cat)
	}
	sort.Strings(r.TypeCategories)

	// Select roots of the inheritance tree. This includes roots of the visible
	// "non-removed" tree, roots of the hidden "removed" tree, and any classes
	// that sit on the boundary between the two. The last condition shouldn't
	// happen in practice, but it pays to be prepared.
	for name, classIndex := range r.Class {
		classDump := dump.Classes[name]
		if classDump == nil {
			fmt.Printf("CHECK: missing class %q from dump\n", name)
			continue
		}
		if classDump.Superclass == "" {
			// Has no superclass, is automatically a root.
			r.RootClasses = append(r.RootClasses, name)
			continue
		}
		superclassIndex := r.Class[classDump.Superclass]
		if superclassIndex == nil {
			// Has superclass that is not present in tree.
			r.RootClasses = append(r.RootClasses, name)
			continue
		}
		if !classIndex.Removed && superclassIndex.Removed {
			// Is not removed while having a removed superclass. That is, while
			// it may still inherit from a hidden "removed" tree, visibly, it
			// looks like a root.
			r.RootClasses = append(r.RootClasses, name)
		}
	}
	sort.Strings(r.RootClasses)

	// Superclasses
	for name, classIndex := range r.Class {
		classDump := dump.Classes[name]
		if classDump == nil {
			fmt.Printf("CHECK: missing class %q from dump\n", name)
			continue
		}
		for super := dump.Classes[classDump.Superclass]; super != nil; {
			classIndex.Superclasses = append(classIndex.Superclasses, super.Name)
			super = dump.Classes[super.Superclass]
		}
		if classIndex.Superclasses == nil {
			classIndex.Superclasses = []id.Class{}
		}
	}

	// Subclasses
	for name := range r.Class {
		classDump := dump.Classes[name]
		if classDump == nil {
			fmt.Printf("CHECK: missing class %q from dump\n", name)
			continue
		}
		if superclassIndex := r.Class[classDump.Superclass]; superclassIndex != nil {
			superclassIndex.Subclasses = append(superclassIndex.Subclasses, name)
		}
	}
	for _, classIndex := range r.Class {
		if classIndex.Subclasses == nil {
			classIndex.Subclasses = []id.Class{}
			continue
		}
		sort.Strings(classIndex.Subclasses)
	}

	// EnumItems
	for name, enumIndex := range r.Enum {
		enumDump := dump.Enums[name]
		if enumDump == nil {
			fmt.Printf("CHECK: missing enum %q from dump\n", name)
			continue
		}
		byIndex := make([]*rbxdump.EnumItem, 0, len(enumDump.Items))
		byValue := make([]*rbxdump.EnumItem, 0, len(enumDump.Items))
		for _, item := range enumDump.Items {
			byIndex = append(byIndex, item)
			byValue = append(byValue, item)
		}
		sort.Slice(byIndex, func(i, j int) bool {
			if byIndex[i].Index != byIndex[j].Index {
				return byIndex[i].Index < byIndex[j].Index
			}
			return byIndex[i].Name < byIndex[j].Name
		})
		sort.Slice(byValue, func(i, j int) bool {
			if byValue[i].Value != byValue[j].Value {
				return byValue[i].Value < byValue[j].Value
			}
			return byValue[i].Name < byValue[j].Name
		})
		enumIndex.ItemsByIndex = make([]string, len(byIndex))
		for i, item := range byIndex {
			enumIndex.ItemsByIndex[i] = item.Name
		}
		enumIndex.ItemsByValue = make([]string, len(byValue))
		for i, item := range byValue {
			enumIndex.ItemsByValue[i] = item.Name
		}
	}

	for className, members := range r.Member {
		classIndex := r.Class[className]
		for memberName, memberIndex := range members {
			classDump := dump.Classes[className]
			if classDump == nil {
				fmt.Printf("CHECK: missing class %q from dump\n", className)
				continue
			}
			memberDump := classDump.Members[memberName]
			if memberDump == nil {
				fmt.Printf("CHECK: missing member %s.%q from dump\n", className, memberName)
				continue
			}
			forEachType(memberDump.Fields(nil), func(ref TypeRef) {
				ref.Class = className
				ref.Member = memberName
				ref.MemberType = memberDump.MemberType()
				ref.Removed = memberIndex.Removed || classIndex.Removed
				switch ref.Type.Category {
				case "Class":
					classIndex.Related = append(classIndex.Related, ref)
					memberIndex.Related = append(memberIndex.Related, ref)
					refClassIndex := r.Class[ref.Type.Name]
					if refClassIndex == nil {
						fmt.Printf("CHECK: missing class %q from index\n", ref.Type.Name)
						break
					}
					refClassIndex.Related = append(refClassIndex.Related, ref)
				case "Enum":
					classIndex.Related = append(classIndex.Related, ref)
					memberIndex.Related = append(memberIndex.Related, ref)
					refEnumIndex := r.Enum[ref.Type.Name]
					if refEnumIndex == nil {
						fmt.Printf("CHECK: missing enum %q from index\n", ref.Type.Name)
						break
					}
					refEnumIndex.Related = append(refEnumIndex.Related, ref)
				default:
					classIndex.Related = append(classIndex.Related, ref)
					refTypeIndex := r.Type[ref.Type.Name]
					if refTypeIndex == nil {
						fmt.Printf("CHECK: missing type %q from index\n", ref.Type.Name)
						break
					}
					refTypeIndex.Related = append(refTypeIndex.Related, ref)
				}
			})
		}
	}

	for _, index := range r.Class {
		sort.Sort(index.Related)
		if index.Removed {
			for _, superID := range index.Superclasses {
				super := r.Class[superID]
				super.HasRemoved = true
			}
		}
	}
	for _, members := range r.Member {
		for _, index := range members {
			sort.Sort(index.Related)
		}
	}
	for _, index := range r.Enum {
		sort.Sort(index.Related)
	}
	for _, index := range r.Type {
		sort.Sort(index.Related)
		count := 0
		for _, ref := range index.Related {
			if !ref.Removed {
				count++
			}
		}
		index.Removed = count == 0
	}

	return nil
}

// TypeRef represents a reference to a type from a member.
type TypeRef struct {
	Class      id.Class      // Class name.
	Member     id.Member     // Member name.
	MemberType id.MemberType // Member type.
	Removed    bool          // Whether member is removed.
	Field      string        // Index of Fields.
	Kind       string        // Type: rbxdump.Type; Parameter: rbxdump.Parameter.
	Index      int           // Index within slice value. -1: Not a slice.
	Type       rbxdump.Type  // Type value.
}

func forEachType(fields rbxdump.Fields, walk func(ref TypeRef)) {
	for field, value := range fields {
		switch value := value.(type) {
		case rbxdump.Type:
			walk(TypeRef{Field: field, Kind: "Type", Index: -1, Type: value})
		case rbxdump.Parameter:
			walk(TypeRef{Field: field, Kind: "Parameter", Index: -1, Type: value.Type})
		case []rbxdump.Type:
			for i, value := range value {
				walk(TypeRef{Field: field, Kind: "Type", Index: i, Type: value})
			}
		case []rbxdump.Parameter:
			for i, value := range value {
				walk(TypeRef{Field: field, Kind: "Parameter", Index: i, Type: value.Type})
			}
		}
	}
}

var sortMemberType = map[string]int{
	"Property": 4,
	"Function": 3,
	"Event":    2,
	"Callback": 1,
}

type TypeRefs []TypeRef

func (t TypeRefs) Len() int      { return len(t) }
func (t TypeRefs) Swap(i, j int) { t[i], t[j] = t[j], t[i] }
func (t TypeRefs) Less(i, j int) bool {
	u, v := t[i], t[j]
	if u.Removed != v.Removed {
		return !u.Removed && v.Removed
	}
	if u.Class != v.Class {
		return u.Class < v.Class
	}
	if sortMemberType[u.MemberType] != sortMemberType[v.MemberType] {
		return sortMemberType[u.MemberType] > sortMemberType[v.MemberType]
	}
	if u.MemberType != v.MemberType {
		return u.MemberType < v.MemberType
	}
	if u.Member != v.Member {
		return u.Member < v.Member
	}
	if u.Field != v.Field {
		return u.Field < v.Field
	}
	if u.Kind != v.Kind {
		return u.Kind < v.Kind
	}
	if u.Index != v.Index {
		return u.Index < v.Index
	}
	if u.Type.Category != v.Type.Category {
		return u.Type.Category < v.Type.Category
	}
	if u.Type.Name != v.Type.Name {
		return u.Type.Name < v.Type.Name
	}
	return !u.Type.Optional && v.Type.Optional
}
