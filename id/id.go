// Provides identifiers for various API object types.
package id

type Class = string
type Member = string
type MemberID = struct {
	Class  Class
	Member Member
}

type Enum = string
type EnumItem = string
type EnumItemID = struct {
	Enum     Enum
	EnumItem EnumItem
}

type Type = string
type TypeCategory = string
type TypeID = struct {
	Category TypeCategory
	Type     Type
}

type MemberType = string
