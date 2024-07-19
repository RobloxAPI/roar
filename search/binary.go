package search

import (
	"bufio"
	"bytes"
	"cmp"
	"encoding/binary"
	"io"
	"os"
	"slices"

	"github.com/robloxapi/rbxdump"
	"github.com/robloxapi/roar/id"
	"github.com/robloxapi/roar/index"
)

func keys[K cmp.Ordered, V any](m map[K]V) []K {
	ks := make([]K, 0, len(m))
	for k := range m {
		ks = append(ks, k)
	}
	slices.Sort(ks)
	return ks
}

// A method to encode v to offset i with the row.
type method func(row []byte, i, v int)

// Represents the encoding of an entity field within a data table row.
type field struct {
	method method // The method used to encode a value.
	offset int    // The byte offset within the row.
}

// Encoding of various entity fields. Different fields may be encoded depending
// on the entity type, such that each row is effectively a union of all entity
// types.
var (
	// Entity

	_PRIMARY   = field{s2, 0} // Primary identifier
	_SECONDARY = field{s2, 2} // Secondary identifier
	_FLAGS     = field{f4, 4} // Entity flags

	// Class

	_CLASS_NAME   = field{s2, 0}  // class.Name
	_SUPERCLASSES = field{n1, 8}  // Number of superclasses of class
	_SUBCLASSES   = field{n2, 9}  // Number of subclasses of class
	_MEMBERS      = field{n2, 11} // len(class.Members)
	_ANCESTOR     = field{n1, 13} // Order index of superclass
	_SUPERCLASS   = field{s2, 15} // Specific superclass of class
	_SUBCLASS     = field{s2, 17} // Specific subclass of class
	_MEM_CAT      = field{s2, 19} // class.MemoryCategory

	// Member (property, function, event, callback)

	_MEMBER_NAME   = field{s2, 2}  // member.Name
	_THREAD_SAFETY = field{e0, 13} // member.ThreadSafety
	_SECURITY      = field{e1, 13} // member.Security

	// Property

	_CAN_SAVE        = field{b1, 11} // property.CanSave
	_CAN_LOAD        = field{b1, 12} // property.CanLoad
	_READ_SECURITY   = field{e1, 13} // property.ReadSecurity
	_WRITE_SECURITY  = field{e0, 14} // property.WriteSecurity
	_VALUE_TYPE_CAT  = field{e1, 14} // property.ValueType.Category
	_VALUE_TYPE_NAME = field{s2, 15} // property.ValueType.Name
	_CATEGORY        = field{s2, 19} // property.Category
	_DEFAULT         = field{s2, 21} // property.Default

	// Function, event, callback

	_RETURNS          = field{n1, 8}  // len(member.ReturnType)
	_PARAMETERS       = field{n2, 9}  // len(member.Parameters)
	_PARAM_TYPE_OPT   = field{b1, 11} // member.Parameters[].Type.Optional
	_RETURN_TYPE_OPT  = field{b1, 12} // member.ReturnType[].Optional
	_PARAM_TYPE_CAT   = field{e0, 14} // member.Parameters[].Type.Category
	_RETURN_TYPE_CAT  = field{e1, 14} // member.ReturnType[].Category
	_RETURN_TYPE_NAME = field{s2, 15} // member.ReturnType[].Name
	_PARAM_TYPE_NAME  = field{s2, 17} // member.Parameters[].Type.Name
	_PARAM_NAME       = field{s2, 19} // member.Parameters[].Name
	_PARAM_DEFAULT    = field{s2, 21} // member.Parameters[].Default (if Optional)

	// Enum

	_ENUM_NAME  = field{s2, 0} // enum.Name
	_ENUM_ITEMS = field{n2, 9} // len(enum.Items)

	// EnumItem

	_ITEM_NAME    = field{s2, 2}  // enumitem.Name
	_LEGACY_NAMES = field{n1, 8}  // len(enumitem.LegacyNames)
	_ITEM_VALUE   = field{n4, 9}  // enumitem.Value
	_LEGACY_NAME  = field{s2, 15} // enumitem.LegacyName[]

	// Type

	_TYPE_NAME = field{s2, 0}  // type.Name
	_TYPE_CAT  = field{e0, 14} // type.Category
)

// 4-bit enumeration packed into lower 4 bits.
func e0(row []byte, i, v int) {
	row[i] = (row[i] & 0b11110000) | byte((v&0b1111)<<0)
}

// 4-bit enumeration packed into upper 4 bits.
func e1(row []byte, i, v int) {
	row[i] = (row[i] & 0b00001111) | byte((v&0b1111)<<4)
}

// 8-bit enumeration. Value is an index of a prefabricated array of string
// indices.
func e2(row []byte, i, v int) {
	row[i] = byte(v)
}

// String. Value is an index of an array of strings.
func s2(row []byte, i, v int) {
	binary.LittleEndian.PutUint16(row[i:], uint16(v))
}

// Flags. Value is a bit field.Bit representation is determined by header.
func f4(row []byte, i, v int) {
	binary.LittleEndian.PutUint32(row[i:], uint32(v))
}

// uint8.
func n1(row []byte, i, v int) {
	row[i] = byte(v)
}

// uint16.
func n2(row []byte, i, v int) {
	binary.LittleEndian.PutUint16(row[i:], uint16(v))
}

// uint32.
func n4(row []byte, i, v int) {
	binary.LittleEndian.PutUint32(row[i:], uint32(v))
}

// 8-bit Bool.
func b1(row []byte, i int, v int) {
	row[i] = byte(v)
}

// Converts a bool to an integer. 1==true, 0==false.
func booli(v bool) int {
	if v {
		return 1
	}
	return 0
}

type cell struct {
	field
	value int
}

type table struct {
	rows int
	buf  bytes.Buffer
}

// Writes a new row to the table. Unset cells are filled with ones.
func (t *table) row(cells ...cell) {
	t.rows++
	// row := [24]byte{}
	row := [23]byte{}
	for i := range row {
		row[i] = 0xFF
	}
	for _, cell := range cells {
		if cell.method == nil {
			continue
		}
		cell.method(row[:], cell.offset, cell.value)
	}
	t.buf.Write(row[:])
}

// Used to encode a number of strings to bit flags. The first bit is reserved
// for the removed state of an entity. Appended flags are assumed to be entity
// tags.
type flags map[string]int

// Assigns flag to the next available bit, if flag has not already been
// assigned.
func (f flags) append(flag string) {
	if _, ok := f[flag]; !ok {
		f[flag] = len(f)
	}
}

// Produces a value containing the flags set according to the given arguments.
func (f flags) bits(fielder rbxdump.Fielder, removed bool) (v int) {
	if removed {
		v |= 1
	}
	if fielder != nil {
		fields := fielder.Fields(nil)
		if tags, ok := fields["Tags"].(rbxdump.Tags); ok {
			for _, tag := range tags {
				if n, ok := f[tag]; ok {
					v |= 1 << (n + 1)
				}
			}
		}
	}
	return v
}

// Packs a number of strings into an index by concatenating..
type blob struct {
	b bytes.Buffer
	i []int
	m map[string]int
}

// Returns the length of the concatenated buffer.
func (b *blob) Len() int {
	return b.b.Len()
}

// Returns the number of strings in the blob.
func (b *blob) Count() int {
	return len(b.i)
}

// Adds each argument to the blob.
func (b *blob) Append(s ...string) {
	for _, s := range s {
		b.Index(s)
	}
}

// Returns the index of s in the blob. If s in not already in the blob, then it
// is added.
func (b *blob) Index(s string) int {
	if len(s) >= 256 {
		s = s[:256]
	}
	if v, ok := b.m[s]; ok {
		return v
	} else {
		if b.m == nil {
			b.m = map[string]int{}
		}
		v = len(b.m)
		b.m[s] = v
		b.i = append(b.i, len(s))
		b.b.WriteString(s)
		return v
	}
}

// Returns a cell encoding param.Default if param.Optional is true, and an empty
// cell otherwise.
func paramDefault(b *blob, param rbxdump.Parameter) cell {
	if param.Optional {
		return cell{_PARAM_DEFAULT, b.Index(param.Default)}
	}
	return cell{}
}

func enumerate(dump *rbxdump.Root, b *blob, visit func(map[string]struct{})) (indices []int, index map[string]int, items []string) {
	uniq := map[string]struct{}{}
	visit(uniq)
	items = keys(uniq)
	b.Append(items...)
	indices = make([]int, 0, len(items))
	index = make(map[string]int, len(items))
	for _, item := range items {
		index[item] = len(index)
		indices = append(indices, b.Index(item))
	}
	return indices, index, items
}

// Visits each entry to m ordered by K.
func visit[Map ~map[K]V, K cmp.Ordered, V any](m Map, visit func(k K, v V)) {
	sorted := make([]K, 0, len(m))
	for k := range m {
		sorted = append(sorted, k)
	}
	slices.Sort(sorted)
	for _, k := range sorted {
		visit(k, m[k])
	}
}

func WriteDB(path string, idx *index.Root, dump *rbxdump.Root) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	// Initialize blob.
	b := blob{}
	b.Append("")

	// Generate enumerations.
	types := []string{}
	types = append(types, "Class")
	types = append(types, idx.MemberTypes...)
	types = append(types, "Enum")
	types = append(types, "EnumItem")
	types = append(types, "Type")
	b.Append(types...)
	typeIndices := make([]int, 0, len(types))
	typeIndex := make(map[string]int, len(types))
	for _, typ := range types {
		typeIndex[typ] = len(typeIndex)
		typeIndices = append(typeIndices, b.Index(typ))
	}

	flags := flags{}
	tagIndices, _, tags := enumerate(dump, &b, func(uniq map[string]struct{}) {
		visitTags(dump, func(tag string) {
			uniq[tag] = struct{}{}
		})
	})
	for _, tag := range tags {
		flags.append(tag)
	}

	secIndices, secIndex, _ := enumerate(dump, &b, func(uniq map[string]struct{}) {
		visitSecurities(dump, func(sec string) {
			if sec == "None" {
				sec = ""
			}
			uniq[sec] = struct{}{}
		})
	})

	safeIndices, safeIndex, _ := enumerate(dump, &b, func(uniq map[string]struct{}) {
		visitSecurities(dump, func(sec string) {
			visitSafeties(dump, func(safe string) {
				uniq[safe] = struct{}{}
			})
		})
	})

	catIndices, catIndex, _ := enumerate(dump, &b, func(uniq map[string]struct{}) {
		visitCats(idx, func(cat string) {
			uniq[cat] = struct{}{}
		})
	})

	// Generate tables per entity type.
	typeTables := make(map[string]*table, len(types))
	for _, typ := range types {
		typeTables[typ] = &table{}
	}
	visit(idx.Class, func(k id.Class, i *index.Class) {
		d := dump.Classes[k]
		if d == nil {
			return
		}

		typeTables["Class"].row(
			cell{_CLASS_NAME, b.Index(k)},
			cell{_FLAGS, flags.bits(d, i.Removed)},
			cell{_SUPERCLASSES, len(i.Superclasses)},
			cell{_SUBCLASSES, len(i.Subclasses)},
			cell{_MEMBERS, len(idx.Member[k])},
			cell{_MEM_CAT, b.Index(d.MemoryCategory)},
		)
		for i, sup := range i.Superclasses {
			typeTables["Class"].row(
				cell{_CLASS_NAME, b.Index(k)},
				cell{_ANCESTOR, i},
				cell{_SUPERCLASS, b.Index(sup)},
			)
		}
		for _, sub := range i.Subclasses {
			typeTables["Class"].row(
				cell{_CLASS_NAME, b.Index(k)},
				cell{_SUBCLASS, b.Index(sub)},
			)
		}
		visit(idx.Member[k], func(k id.Member, i *index.Member) {
			d := d.Members[k]
			if d == nil {
				return
			}
			switch d := d.(type) {
			case *rbxdump.Property:
				typeTables[d.MemberType()].row(
					cell{_CLASS_NAME, b.Index(i.Class)},
					cell{_MEMBER_NAME, b.Index(k)},
					cell{_FLAGS, flags.bits(d, i.Removed)},
					cell{_CAN_SAVE, booli(d.CanSave)},
					cell{_CAN_LOAD, booli(d.CanLoad)},
					cell{_READ_SECURITY, secIndex[d.ReadSecurity]},
					cell{_THREAD_SAFETY, safeIndex[d.ThreadSafety]},
					cell{_VALUE_TYPE_CAT, catIndex[d.ValueType.Category]},
					cell{_WRITE_SECURITY, secIndex[d.WriteSecurity]},
					cell{_VALUE_TYPE_NAME, b.Index(d.ValueType.Name)},
					cell{_CATEGORY, b.Index(d.Category)},
					cell{_DEFAULT, b.Index(d.Default)},
				)
			case *rbxdump.Function:
				typeTables[d.MemberType()].row(
					cell{_CLASS_NAME, b.Index(i.Class)},
					cell{_MEMBER_NAME, b.Index(k)},
					cell{_FLAGS, flags.bits(d, i.Removed)},
					cell{_RETURNS, len(d.ReturnType)},
					cell{_PARAMETERS, len(d.Parameters)},
					cell{_SECURITY, secIndex[d.Security]},
					cell{_THREAD_SAFETY, safeIndex[d.ThreadSafety]},
				)
				for _, ret := range d.ReturnType {
					typeTables[d.MemberType()].row(
						cell{_CLASS_NAME, b.Index(i.Class)},
						cell{_MEMBER_NAME, b.Index(k)},
						cell{_RETURN_TYPE_OPT, booli(ret.Optional)},
						cell{_RETURN_TYPE_CAT, catIndex[ret.Category]},
						cell{_RETURN_TYPE_NAME, b.Index(ret.Name)},
					)
				}
				for _, param := range d.Parameters {
					typeTables[d.MemberType()].row(
						cell{_CLASS_NAME, b.Index(i.Class)},
						cell{_MEMBER_NAME, b.Index(k)},
						cell{_PARAM_TYPE_OPT, booli(param.Type.Optional)},
						cell{_PARAM_TYPE_CAT, catIndex[param.Type.Category]},
						cell{_PARAM_TYPE_NAME, b.Index(param.Type.Name)},
						cell{_PARAM_NAME, b.Index(param.Name)},
						paramDefault(&b, param),
					)
				}
			case *rbxdump.Event:
				typeTables[d.MemberType()].row(
					cell{_CLASS_NAME, b.Index(i.Class)},
					cell{_MEMBER_NAME, b.Index(k)},
					cell{_FLAGS, flags.bits(d, i.Removed)},
					cell{_PARAMETERS, len(d.Parameters)},
					cell{_SECURITY, secIndex[d.Security]},
					cell{_THREAD_SAFETY, safeIndex[d.ThreadSafety]},
				)
				for _, param := range d.Parameters {
					typeTables[d.MemberType()].row(
						cell{_CLASS_NAME, b.Index(i.Class)},
						cell{_MEMBER_NAME, b.Index(k)},
						cell{_PARAM_TYPE_OPT, booli(param.Type.Optional)},
						cell{_PARAM_TYPE_CAT, catIndex[param.Type.Category]},
						cell{_PARAM_TYPE_NAME, b.Index(param.Type.Name)},
						cell{_PARAM_NAME, b.Index(param.Name)},
					)
				}
			case *rbxdump.Callback:
				typeTables[d.MemberType()].row(
					cell{_CLASS_NAME, b.Index(i.Class)},
					cell{_MEMBER_NAME, b.Index(k)},
					cell{_FLAGS, flags.bits(d, i.Removed)},
					cell{_RETURNS, len(d.ReturnType)},
					cell{_PARAMETERS, len(d.Parameters)},
					cell{_SECURITY, secIndex[d.Security]},
					cell{_THREAD_SAFETY, safeIndex[d.ThreadSafety]},
				)
				for _, ret := range d.ReturnType {
					typeTables[d.MemberType()].row(
						cell{_CLASS_NAME, b.Index(i.Class)},
						cell{_MEMBER_NAME, b.Index(k)},
						cell{_RETURN_TYPE_OPT, booli(ret.Optional)},
						cell{_RETURN_TYPE_CAT, catIndex[ret.Category]},
						cell{_RETURN_TYPE_NAME, b.Index(ret.Name)},
					)
				}
				for _, param := range d.Parameters {
					typeTables[d.MemberType()].row(
						cell{_CLASS_NAME, b.Index(i.Class)},
						cell{_MEMBER_NAME, b.Index(k)},
						cell{_PARAM_TYPE_OPT, booli(param.Type.Optional)},
						cell{_PARAM_TYPE_CAT, catIndex[param.Type.Category]},
						cell{_PARAM_TYPE_NAME, b.Index(param.Type.Name)},
						cell{_PARAM_NAME, b.Index(param.Name)},
					)
				}
			default:
				// Unknown member type.
				typeTables[d.MemberType()].row(
					cell{_CLASS_NAME, b.Index(i.Class)},
					cell{_MEMBER_NAME, b.Index(k)},
					cell{_FLAGS, flags.bits(d, i.Removed)},
				)
			}
		})
	})
	visit(idx.Enum, func(k id.Enum, i *index.Enum) {
		d := dump.Enums[k]
		if d == nil {
			return
		}
		typeTables["Enum"].row(
			cell{_ENUM_NAME, b.Index(k)},
			cell{_FLAGS, flags.bits(d, i.Removed)},
			cell{_ENUM_ITEMS, len(idx.EnumItem[k])},
		)
		visit(idx.EnumItem[k], func(k id.EnumItem, i *index.EnumItem) {
			d := d.Items[k]
			if d == nil {
				return
			}
			typeTables["EnumItem"].row(
				cell{_ENUM_NAME, b.Index(i.Enum)},
				cell{_ITEM_NAME, b.Index(k)},
				cell{_FLAGS, flags.bits(d, i.Removed)},
				cell{_LEGACY_NAMES, len(d.LegacyNames)},
				cell{_ITEM_VALUE, d.Value},
			)
			for _, name := range d.LegacyNames {
				typeTables["EnumItem"].row(
					cell{_ENUM_NAME, b.Index(i.Enum)},
					cell{_ITEM_NAME, b.Index(k)},
					cell{_LEGACY_NAME, b.Index(name)},
				)
			}
		})
	})
	visit(idx.Type, func(k id.Type, i *index.Type) {
		typeTables["Type"].row(
			cell{_TYPE_NAME, b.Index(k)},
			cell{_FLAGS, flags.bits(nil, i.Removed)},
			cell{_TYPE_CAT, catIndex[i.Category]},
		)
	})

	// Write data.
	w := newWriter(f)
	defer w.Flush()

	w.u16(b.Count())
	w.u24(b.Len())
	w.u8(len(typeIndices))
	w.u8(len(tagIndices))
	w.u8(len(secIndices))
	w.u8(len(safeIndices))
	w.u8(len(catIndices))
	for _, typ := range types {
		w.u16(typeTables[typ].rows)
	}

	for _, size := range b.i {
		w.u8(size)
	}
	w.b(b.b.Bytes())
	for _, typ := range typeIndices {
		w.u8(typ)
	}
	for _, tag := range tagIndices {
		w.u8(tag)
	}
	for _, sec := range secIndices {
		w.u8(sec)
	}
	for _, safe := range safeIndices {
		w.u8(safe)
	}
	for _, cat := range catIndices {
		w.u8(cat)
	}
	for _, typ := range types {
		w.b(typeTables[typ].buf.Bytes())
	}

	return nil
}

// Wrapper for encoding various types.
type writer struct {
	w *bufio.Writer
}

func newWriter(w io.Writer) *writer {
	return &writer{w: bufio.NewWriter(w)}
}

func (w *writer) Flush() error {
	return w.w.Flush()
}

func (w *writer) u8(v int) {
	w.w.WriteByte(uint8(v))
}

func (w *writer) u16(v int) {
	var b [2]byte
	binary.LittleEndian.PutUint16(b[:], uint16(v))
	w.w.Write(b[:])
}

func (w *writer) u24(v int) {
	var b [4]byte
	binary.LittleEndian.PutUint32(b[:], uint32(v))
	w.w.Write(b[:3])
}

func (w *writer) u32(v int) {
	var b [4]byte
	binary.LittleEndian.PutUint32(b[:], uint32(v))
	w.w.Write(b[:])
}

func (w *writer) b(v []byte) {
	w.w.Write(v)
}

// Visits every entity tag found in dump.
func visitTags(dump *rbxdump.Root, visit func(string)) {
	for _, class := range dump.Classes {
		for _, tag := range class.Tags {
			visit(tag)
		}
		for _, member := range class.Members {
			for _, tag := range member.GetTags() {
				visit(tag)
			}
		}
	}
	for _, enum := range dump.Enums {
		for _, tag := range enum.Tags {
			visit(tag)
		}
		for _, item := range enum.Items {
			for _, tag := range item.Tags {
				visit(tag)
			}
		}
	}
}

// Visits every member security field found in dump.
func visitSecurities(dump *rbxdump.Root, visit func(string)) {
	for _, class := range dump.Classes {
		for _, member := range class.Members {
			switch member := member.(type) {
			case *rbxdump.Property:
				visit(member.ReadSecurity)
				visit(member.WriteSecurity)
			case *rbxdump.Function:
				visit(member.Security)
			case *rbxdump.Event:
				visit(member.Security)
			case *rbxdump.Callback:
				visit(member.Security)
			}
		}
	}
}

// Visits every member thread safety field found in dump.
func visitSafeties(dump *rbxdump.Root, visit func(string)) {
	for _, class := range dump.Classes {
		for _, member := range class.Members {
			switch member := member.(type) {
			case *rbxdump.Property:
				visit(member.ThreadSafety)
			case *rbxdump.Function:
				visit(member.ThreadSafety)
			case *rbxdump.Event:
				visit(member.ThreadSafety)
			case *rbxdump.Callback:
				visit(member.ThreadSafety)
			}
		}
	}
}

// Visits every type category found in idx.
func visitCats(idx *index.Root, visit func(string)) {
	visit("Class")
	visit("Enum")
	for _, typ := range keys(idx.Type) {
		visit(idx.Type[typ].Category)
	}
}
