package docs

import "github.com/robloxapi/roar/id"

type Root struct {
	Class    map[id.Class]*Class
	Member   map[id.Class]map[id.Member]*Member
	Enum     map[id.Enum]*Enum
	EnumItem map[id.Enum]map[id.EnumItem]*EnumItem
	Type     map[id.Type]*Type
}

type Doc struct {
	Summary            string   `json:",omitempty"`
	Description        string   `json:",omitempty"`
	DeprecationMessage string   `json:",omitempty"`
	CodeSamples        []string `json:",omitempty"`
}
type Class struct {
	Category string `json:",omitempty"`
	Doc
}
type Member struct {
	Doc
}
type Enum struct {
	Doc
}
type EnumItem struct {
	Doc
}
type Type struct {
	Constants      []Constant    `json:",omitempty"`
	Constructors   []Constructor `json:",omitempty"`
	Functions      []Function    `json:",omitempty"`
	MathOperations []Operation   `json:",omitempty"`
	Methods        []Method      `json:",omitempty"`
	Properties     []Property    `json:",omitempty"`
	Tags           []string      `json:",omitempty"`
	Doc
}

type Constant struct {
	Name string
	Type string
	Tags []string `json:",omitempty"`
	Doc
}
type Constructor struct {
	Name       string
	Parameters []Parameter
	Tags       []string `json:",omitempty"`
	Doc
}
type Function struct {
	Name       string
	Parameters []Parameter
	Returns    []Return
	Tags       []string `json:",omitempty"`
	Doc
}
type Operation struct {
	Operation  string
	TypeA      string
	TypeB      string
	ReturnType string
	Tags       []string `json:",omitempty"`
	Doc
}
type Method struct {
	Name       string
	Parameters []Parameter
	Returns    []Return
	Tags       []string `json:",omitempty"`
	Doc
}
type Property struct {
	Name string
	Type string
	Tags []string `json:",omitempty"`
	Doc
}

type Parameter struct {
	Name    string
	Type    string
	Default any
	Summary string `json:",omitempty"`
}
type Return struct {
	Type    string
	Summary string `json:",omitempty"`
}
