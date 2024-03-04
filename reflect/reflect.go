// Provides a queryable representation of ReflectionMetadata.
package reflect

import (
	"io"

	"github.com/robloxapi/rbxfile"
	"github.com/robloxapi/rbxfile/json"
	"github.com/robloxapi/rbxfile/rbxlx"
	"github.com/robloxapi/roar/id"
)

type Root struct {
	Class map[id.Class]Class `json:"class,omitempty"`
	Enum  map[id.Enum]Enum   `json:"enum,omitempty"`
}

type Class struct {
	Member   map[id.Member]Member `json:"member,omitempty"`
	Metadata Metadata             `json:"metadata,omitempty"`
}

type Member struct {
	Metadata Metadata `json:"metadata,omitempty"`
}

type Enum struct {
	EnumItem map[id.EnumItem]EnumItem `json:"item,omitempty"`
	Metadata Metadata                 `json:"metadata,omitempty"`
}

type EnumItem struct {
	Metadata Metadata `json:"metadata,omitempty"`
}

type Metadata map[string]Value

type Value struct {
	Type  string `json:"type"`
	Value any    `json:"value"`
}

func ParseReflectionMetadata(r io.Reader) (root Root, err error) {
	rroot, _, err := rbxlx.Decoder{DiscardInvalidProperties: true}.Decode(r)
	if err != nil {
		return root, err
	}
	root.Class = map[id.Class]Class{}
	root.Enum = map[id.Enum]Enum{}
	for _, itop := range rroot.Instances {
		switch itop.ClassName {
		case "ReflectionMetadataClasses":
			for _, iclass := range itop.Children {
				if iclass.ClassName != "ReflectionMetadataClass" {
					continue
				}
				name, ok := iclass.Properties["Name"].(rbxfile.ValueString)
				if !ok {
					continue
				}
				class := Class{
					Metadata: make(Metadata, len(iclass.Properties)-1),
					Member:   make(map[string]Member, len(iclass.Children)),
				}
				classEmpty := true
				for prop, value := range iclass.Properties {
					if prop == "Name" {
						continue
					}
					class.Metadata[prop] = Value{
						Type:  value.Type().String(),
						Value: json.ValueToJSONInterface(value, nil),
					}
					classEmpty = false
				}
				for _, imembers := range iclass.Children {
					switch imembers.ClassName {
					case "ReflectionMetadataEvents":
					case "ReflectionMetadataCallbacks":
					case "ReflectionMetadataFunctions":
					case "ReflectionMetadataProperties":
					case "ReflectionMetadataYieldFunctions":
					default:
						continue
					}
					for _, imember := range imembers.Children {
						if imember.ClassName != "ReflectionMetadataMember" {
							continue
						}
						name, ok := imember.Properties["Name"].(rbxfile.ValueString)
						if !ok {
							continue
						}
						member := Member{
							Metadata: make(Metadata, len(iclass.Properties)-1),
						}
						memberEmpty := true
						for prop, value := range imember.Properties {
							if prop == "Name" {
								continue
							}
							member.Metadata[prop] = Value{
								Type:  value.Type().String(),
								Value: json.ValueToJSONInterface(value, nil),
							}
							memberEmpty = false
						}
						if !memberEmpty {
							class.Member[string(name)] = member
							classEmpty = false
						}
					}
				}
				if !classEmpty {
					root.Class[string(name)] = class
				}
			}
		case "ReflectionMetadataEnums":
			for _, ienum := range itop.Children {
				if ienum.ClassName != "ReflectionMetadataEnum" {
					continue
				}
				name, ok := ienum.Properties["Name"].(rbxfile.ValueString)
				if !ok {
					continue
				}
				enum := Enum{
					Metadata: make(Metadata, len(ienum.Properties)-1),
					EnumItem: make(map[string]EnumItem, len(ienum.Children)),
				}
				enumEmpty := true
				for prop, value := range ienum.Properties {
					if prop == "Name" {
						continue
					}
					enum.Metadata[prop] = Value{
						Type:  value.Type().String(),
						Value: json.ValueToJSONInterface(value, nil),
					}
					enumEmpty = false
				}
				for _, iitem := range ienum.Children {
					if iitem.ClassName != "ReflectionMetadataEnumItem" {
						continue
					}
					name, ok := iitem.Properties["Name"].(rbxfile.ValueString)
					if !ok {
						continue
					}
					item := EnumItem{
						Metadata: make(Metadata, len(ienum.Properties)-1),
					}
					itemEmpty := true
					for prop, value := range iitem.Properties {
						if prop == "Name" {
							continue
						}
						item.Metadata[prop] = Value{
							Type:  value.Type().String(),
							Value: json.ValueToJSONInterface(value, nil),
						}
						itemEmpty = false
					}
					if !itemEmpty {
						enum.EnumItem[string(name)] = item
						enumEmpty = false
					}
				}
				if !enumEmpty {
					root.Enum[string(name)] = enum
				}
			}
		}
	}
	return root, nil
}
