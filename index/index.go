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
	ClassesByRoot []id.Class
	MemberTypes   []id.MemberType

	Class    map[id.Class]*Class
	Member   map[id.Class]map[id.Member]*Member
	Enum     map[id.Enum]*Enum
	EnumItem map[id.Enum]map[id.EnumItem]*EnumItem
	Type     map[id.TypeCategory]map[id.Type]*Type
}

type Related struct {
	ClassesByName   []id.Class
	MembersByName   []id.MemberID
	EnumsByName     []id.Enum
	EnumItemsByName []id.EnumItemID
}

type Class struct {
	Removed                bool
	SubclassesByName       []id.Class
	SuperclassesByAncestry []id.Class
	Related                Related `json:"-"`
}

type Member struct {
	Removed bool
	Related Related `json:"-"`
}

type Enum struct {
	Removed          bool
	EnumItemsByValue []id.EnumItem
	EnumItemsByIndex []id.EnumItem
	Related          Related `json:"-"`
}

type EnumItem struct {
	Removed bool
}

type Type struct {
	Removed bool
	Count   int
	Related Related `json:"-"`
}

func (r *Root) Build(hist *history.Root, dump *rbxdump.Root) error {
	r.MemberTypes = slices.Clone(MemberTypes)

	r.Class = map[id.Class]*Class{}
	for i, changes := range hist.Object.Class {
		class := Class{Removed: true}
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
		member := Member{Removed: true}
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
		enum := Enum{Removed: true}
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
		item := EnumItem{Removed: true}
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

	r.Type = map[id.TypeCategory]map[id.Type]*Type{}
	for i, refs := range hist.Object.Type {
		typ := Type{Removed: true}
		count := 0
		for _, ref := range refs {
			if ref.Prev {
				count--
			} else {
				count++
			}
		}
		typ.Count = count
		typ.Removed = count == 0

		types := r.Type[i.Category]
		if types == nil {
			types = map[id.Type]*Type{}
			r.Type[i.Category] = types
		}
		types[i.Type] = &typ
	}

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
			r.ClassesByRoot = append(r.ClassesByRoot, name)
			continue
		}
		superclassIndex := r.Class[classDump.Superclass]
		if superclassIndex == nil {
			// Has superclass that is not present in tree.
			r.ClassesByRoot = append(r.ClassesByRoot, name)
			continue
		}
		if !classIndex.Removed && superclassIndex.Removed {
			// Is not removed while having a removed superclass. That is, while
			// it may still inherit from a hidden "removed" tree, visibly, it
			// looks like a root.
			r.ClassesByRoot = append(r.ClassesByRoot, name)
		}
	}
	sort.Strings(r.ClassesByRoot)

	// Superclasses
	for name, classIndex := range r.Class {
		classDump := dump.Classes[name]
		if classDump == nil {
			fmt.Printf("CHECK: missing class %q from dump\n", name)
			continue
		}
		for super := dump.Classes[classDump.Superclass]; super != nil; {
			classIndex.SuperclassesByAncestry = append(classIndex.SuperclassesByAncestry, super.Name)
			super = dump.Classes[super.Superclass]
		}
		if classIndex.SuperclassesByAncestry == nil {
			classIndex.SuperclassesByAncestry = []id.Class{}
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
			superclassIndex.SubclassesByName = append(superclassIndex.SubclassesByName, name)
		}
	}
	for _, classIndex := range r.Class {
		if classIndex.SubclassesByName == nil {
			classIndex.SubclassesByName = []id.Class{}
			continue
		}
		sort.Strings(classIndex.SubclassesByName)
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
		sort.Slice(byIndex, func(i, j int) bool { return byIndex[i].Index < byIndex[j].Index })
		sort.Slice(byValue, func(i, j int) bool { return byValue[i].Value < byValue[j].Value })
		enumIndex.EnumItemsByIndex = make([]string, len(byIndex))
		for i, item := range byIndex {
			enumIndex.EnumItemsByIndex[i] = item.Name
		}
		enumIndex.EnumItemsByValue = make([]string, len(byValue))
		for i, item := range byValue {
			enumIndex.EnumItemsByValue[i] = item.Name
		}
	}

	return nil
}
