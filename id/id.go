// Provides identifiers for various API object types.
package id

type Class = string
type Member = string

type Enum = string
type Item = string

type Type = string
type TypeCategory = string
type MemberType = string

type MemberID = struct {
	Class  Class
	Member Member
}

type ItemID = struct {
	Enum Enum
	Item Item
}
