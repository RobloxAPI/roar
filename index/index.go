// Provides structure for the primary API data index.
package index

import "github.com/robloxapi/roar/id"

type Root struct {
	ClassesByRoot        []id.Class
	ClassesByName        []id.Class
	EnumsByName          []id.Enum
	TypesByName          []id.Type
	TypeCategoriesByName []id.TypeCategory
	MemberTypes          []id.MemberType

	Class map[id.Class]Class
	Enum  map[id.Enum]Enum
	Type  map[id.Type]Type
}

type Related struct {
	ClassesByName []id.Class
	MembersByName []id.MemberID
	EnumsByName   []id.Enum
	ItemsByName   []id.ItemID
}

type Class struct {
	SubclassesByName       []id.Class
	SuperclassesByName     []id.Class
	SuperclassesByAncestry []id.Class
	MembersByName          []id.Member
	Removed                bool
	Related                Related
}

type Enum struct {
	ItemsByName  []id.Item
	ItemsByValue []id.Item
	ItemsByIndex []id.Item
	Removed      bool
	Related      Related
}

type Type struct {
	Category id.TypeCategory
	Removed  bool
	Related  Related
}
