+++
title = "Search cheat sheet"
summary = "Cheat sheet for advanced searching."
+++

A search query is an expression made up of a number of **selectors**. When
searching, selectors are matched against each API entity, producing a list of
results.

Search results will be filtered by the current visibility settings.

*Details of the syntax are currently subject to change.*

*~~Crossed out~~ selectors are not yet implemented.*

## Name selectors
The name selectors are the most simple, comparing against the names of entities.

<dl>
{{%selector id="name-fuzzy" text="foo"%}}

Selects entities whose name matches *foo*. Selection is case-insensitive, and
based on a fuzzy matching algorithm.

{{%/selector%}}

{{%selector id="name-sub" text="'foo'"%}}

Selects entities whose name contains the case-sensitive sub-string *foo*.

{{%/selector%}}

{{%selector id="name-exact" text="\"foo\""%}}

Selects entities whose name is exactly equal to *foo*.

{{%/selector%}}

{{%selector id="name-regexp" text="/foo/"%}}

Selects entities whose name matches the regular expression */foo/*.

{{%/selector%}}

{{%selector id="name-any" text="*"%}}

Selects anything.

{{%/selector%}}
</dl>

The name selectors are implemented as [string components](#string) that match
against entity names.

## Compound selector
The compound selector divides entity kinds into two categories. **Primary**
entities include classes, enums, and kinds. **Secondary** entities include
properties, functions, events, callbacks, and enum items.

<dl>
{{%selector id="compound" text="foo.bar"%}}

Selects only secondary entities whose primary name matches *foo* and secondary
name matches *bar*.

{{%/selector%}}

{{%selector id="compound-primary" text="foo."%}}

Selects only primary entities whose name matches *foo*.

{{%/selector%}}

{{%selector id="compound-secondary" text=".bar"%}}

Selects only secondary entities whose name matches *bar*.

{{%/selector%}}
</dl>

Each component is a [string component](#string). That is, an expression like
`"foo"./bar/` is valid.

## Expressions
Multiple selectors can be combined to form complete logical expressions, with
AND, OR, and NOT operators.

<dl>
{{%selector id="op-and" text="foo bar" /%}}
{{%selector id="op-and-alt" text="foo && bar"%}}

Selects entities matching selector *foo* **and** *bar*. That is, whitespace (and
only whitespace) between two selectors is interpreted as an AND operator. For
clarity, the `&&` operator can be used instead.

{{%/selector%}}

{{%selector id="op-or" text="foo, bar" /%}}
{{%selector id="op-or-alt" text="foo || bar"%}}

Selects entities matching selector *foo* **or** *bar*. Either `,` or `||` can be
used to indicate an OR operator.

{{%/selector%}}

{{%selector id="op-not" text="!foo"%}}

Selects entities that do **not** match selector *foo*.

{{%/selector%}}

{{%selector id="group" text="(foo, bar) (!fizz, buzz)"%}}

Parentheses can be used to logically group selectors together.

{{%/selector%}}
</dl>

### Precedence
Logical operators have the following precedence:
1. NOT
2. AND
3. OR

## Field selectors
Field selectors match against particular fields of an entity. They have the form
`field:value`. The *field* part is case-insensitive. The *value* part depends on
the field, but will usually be a [string](#string), [number](#number), or
[bool](#bool) component.

### Kind
The `is:` selector can be used to narrow down a search to certain entity kinds.
Kinds are case-insensitive.

<dl>
{{%selector id="is-class" text="is:class"%}}

Selects only class entities.

{{%/selector%}}

{{%selector id="is-property" text="is:property"%}}

Selects only property entities.

{{%/selector%}}

{{%selector id="is-function" text="is:function"%}}

Selects only function entities.

{{%/selector%}}

{{%selector id="is-event" text="is:event"%}}

Selects only event entities.

{{%/selector%}}

{{%selector id="is-callback" text="is:callback"%}}

Selects only callback entities.

{{%/selector%}}

{{%selector id="is-enum" text="is:enum"%}}

Selects only enum entities.

{{%/selector%}}

{{%selector id="is-enumitem" text="is:enumitem"%}}

Selects only enum item entities.

{{%/selector%}}

{{%selector id="is-type" text="is:type"%}}

Selects only data types.

{{%/selector%}}

{{%selector id="is-primary" text="is:primary"%}}

Selects only class, enum, and type entities.

{{%/selector%}}

{{%selector id="is-secondary" text="is:secondary"%}}

Selects only property, function, event, callback, and enum item entities.

{{%/selector%}}

{{%selector id="is-member" text="is:member"%}}

Selects only property, function, event, and callback entities.

{{%/selector%}}
</dl>

### Fields
<dl>
{{%selector id="tag" text="tag:foo"%}}

Selects entities that have tag *foo*. The tag is case-insensitive, but must
otherwise match exactly.

{{%/selector%}}

{{%selector id="removed" text="removed:yes"%}}

Selects entities that are not present in the current revision of the API
([bool](#bool)).

{{%/selector%}}

{{%selector id="superclasses" text="superclasses:N"%}}

Selects class entities where the number of superclasses matches *N*
([number](#number)).

{{%/selector%}}

{{%selector id="subclasses" text="subclasses:N"%}}

Selects class entities where the number of subclasses matches *N*
([number](#number)).

{{%/selector%}}

{{%selector id="members" text="members:N"%}}

Selects class entities where the number of members matches *N*
([number](#number)).

{{%/selector%}}

{{%selector id="superclass" text="superclass:foo"%}}

Selects class entities with a superclass whose name matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="subclass" text="subclass:foo"%}}

Selects class entities with a subclass whose name matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="memcat" text="memcat:foo"%}}

Selects class entities where the memory category matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="threadsafety" text="threadsafety:foo"%}}

Selects member entities where the thread safety matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="security" text="security:foo"%}}

Selects function, event, and callback entities where the security matches *foo*,
or property entities where the read or write security matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="cansave" text="cansave:yes"%}}

Selects property entities that can be serialized ([bool](#bool)).

{{%/selector%}}

{{%selector id="canload" text="canload:yes"%}}

Matches property entities that can be deserialized ([bool](#bool)).

{{%/selector%}}

{{%selector id="readsecurity" text="readsecurity:foo"%}}

Selects property entities where the read security matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="writesecurity" text="writesecurity:foo"%}}

Selects property entities where the write security matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="valuetypecat" text="valuetypecat:foo"%}}

Selects property entities where the category of the value type matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="valuetypename" text="valuetypename:foo"%}}

Selects property entities where the name of the value type matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="category" text="category:foo"%}}

Selects property entities where the category matches *foo* ([string](#string)).

{{%/selector%}}

{{%selector id="default" text="default:foo"%}}

Selects property entities where the default value matches *foo*
([number](#number) or [string](#string)).

{{%/selector%}}

{{%selector id="returns" text="returns:N"%}}

Selects function and callback entities where the number of return values matches
*N* ([number](#number)).

{{%/selector%}}

{{%selector id="parameters" text="parameters:N"%}}

Selects function, event, and callback entities where the number of parameters
matches *N* ([number](#number)).

{{%/selector%}}

{{%selector id="returntypecat" text="returntypecat:foo"%}}

Selects function and callback entities where the category of a return type
matches *foo* ([string](#string)).

{{%/selector%}}

{{%selector id="returntypename" text="returntypename:foo"%}}

Selects function and callback entities where the name of a return type matches
*foo* ([string](#string)).

{{%/selector%}}

{{%selector id="returntypeopt" text="returntypeopt:yes"%}}

Selects function and callback entities where a return type is optional
([bool](#bool)).

{{%/selector%}}

{{%selector id="paramtypecat" text="paramtypecat:foo"%}}

Selects function, event, and callback entities where the category of a parameter
type matches *foo* ([string](#string)).

{{%/selector%}}

{{%selector id="paramtypename" text="paramtypename:foo"%}}

Selects function, event, and callback entities where the name of a parameter
type matches *foo* ([string](#string)).

{{%/selector%}}

{{%selector id="paramtypeopt" text="paramtypeopt:yes"%}}

Selects function, event, and callback entities where a parameter is optional.
([bool](#bool)).

{{%/selector%}}

{{%selector id="paramname" text="paramname:foo"%}}

Selects function, event, and callback entities where the name of a parameter
matches *foo* ([string](#string)).

{{%/selector%}}

{{%selector id="paramdefault" text="paramdefault:foo"%}}

Selects property entities where the default value of a parameter matches *foo*
([number](#number) or [string](#string)).

{{%/selector%}}

{{%selector id="enumitems" text="enumitems:N"%}}

Selects enum entities where the number of enum items matches *N*
([number](#number)).

{{%/selector%}}

{{%selector id="itemvalue" text="itemvalue:N"%}}

Selects enum item entities where the item value matches *N* ([number](#number)).

{{%/selector%}}

{{%selector id="legacynames" text="legacynames:N"%}}

Selects enum item entities where the number of legacy names matches *N*
([number](#number)).

{{%/selector%}}

{{%selector id="legacyname" text="legacyname:foo"%}}

Selects enum item entities where a legacy name matches *foo*
([string](#string)).

{{%/selector%}}

{{%selector id="typecat" text="typecat:foo"%}}

Selects type entities where the category matches *foo* ([string](#string)).

{{%/selector%}}
</dl>

### List selector
List selectors cause the values of entity fields to be selected instead of the
entities themselves.

List selectors are excluded from the logic of the expression. They do not
determine whether entities match or do not match, but instead alter how the
search results are displayed.

<dl>
{{%selector id="list-field" text="foo:"%}}

Lists aggregated values corresponding to field *foo* for entities matching the
rest of the query. That is, while the field selector `foo:value` will select
entities where field *foo* matches *value*, the list selector `foo:` will select
all possible values of field *foo*.

{{%/selector%}}

{{%selector id="list" text="*:"%}}

Lists all possible fields for entities matching the rest of the query. Each
result can be used as the *field* part of a field selector. That is, if `*:`
returns `foo`, then `foo:` will return all values of field *foo*, and
`foo:value` will match specific values.

{{%/selector%}}
</dl>

The score of each value result is the sum of scores of the aggregated entity
results for that value.

If the remaining query is empty (that is, the entire query is just list
selectors), then all entities are selected.

### Result selectors
Result selectors are used to control search results. They have the form
`/name:value`. The entire selector is case-insensitive.

Result selectors are excluded from the logic of the expression. They do not
determine whether entities match or do not match, but instead alter how the
search results are displayed.

<dl>
{{%selector id="limit" text="/limit:N"%}}

Sets the maximum number of results that will be displayed to *N*, which must be
a positive integer. Defaults to 50.

{{%/selector%}}

{{%selector id="sort" text="/sort:field" notimplemented="1"%}}

: Sorts search results according to value *field*. Values are case-insensitive.
    Defaults to `/sort:score`. The following values are valid:
  - `score`: Sort by score. Defaults to descending.
  - `name`: Sort by entity name. Defaults to ascending.
  - `random`: Shuffle the results randomly.

{{%/selector%}}

{{%selector id="sort-asc" text="/sort:field<" notimplemented="1"%}}

Force *field* to sort ascending.

{{%/selector%}}

{{%selector id="sort-desc" text="/sort:field>" notimplemented="1"%}}

Force *field* to sort descending.

{{%/selector%}}

{{%selector id="go" text="/go:location" notimplemented="1"%}}

If included, when the search is submitted (when the enter key is pressed) the
page will redirect to the page at *location* corresponding to the first search
result. Locations are case-insensitive. The following locations are valid:
- `here`: Redirects to the page on this website (default).
- `docs`: Redirects to the corresponding Creator Hub documentation page.
- `git`: Redirects to the corresponding file in the creator-docs Git repository.

{{%/selector%}}
</dl>

## Components
These are not selectors themselves, but form components of more specific
selectors.

### String
Compares against string-like values.

<dl>
{{%selector id="string-fuzzy" text="text"%}}

Matches *text* against strings using a fuzzy-matching algorithm.
Case-insensitive.

{{%/selector%}}

{{%selector id="string-sub" text="'text'"%}}

Matches strings that contain *text* as a sub-string. Case-sensitive.

{{%/selector%}}

{{%selector id="string-exact" text="\"text\""%}}

Matches strings that are exactly equal to *text*. Case-sensitive.

{{%/selector%}}

{{%selector id="string-regexp" text="/text/"%}}

Matches strings that match the regular expression */text/*. The syntax is
expected match a JavaScript RegExp literal. The only difference is that every
`/` character embedded within the regular expression must be escaped with a `\`
character. That is, while the expression `/[^/]/` may be valid in JavaScript, as
a selector, it must be escaped as `/[^\/]/`. The `i`, `m`, `s`, `u`, and `v`
flags are allowed.

{{%/selector%}}
</dl>

Also includes the [anything](#selector-any) component.

The sub-string and exact-string selectors use `\` for escaping certain
characters. The following escape sequences are transformed:
- `\\`: Single escape character.
- `\'`: Sub-string delimiter.
- `\"`: Exact-string delimiter.
- `\t`: Tab character.
- `\n`: Newline character.
- `\r`: Carriage return character.
- `\␊`: A literal newline is tranformed into no character.
- `\xXX`: Escapes a byte with the hex code *XX*.
- `\uXXXX`: Escapes a unicode character code U+*XXXX*.
- `\UXXXXXXXX`: Escapes a unicode code point U+*XXXXXXXX*. Only codes under
  0x110000 are valid.

Other instances of `\` are interpreted as-is.

### Number
Compares against numeric values.

<dl>
{{%selector id="number-eq" text="N"%}}

Matches numbers that are equal to *N*.

{{%/selector%}}

{{%selector id="number-lt" text="<N"%}}

Matches numbers that are less than *N*.

{{%/selector%}}

{{%selector id="number-le" text="<=N"%}}

Matches numbers that are less than or equal to *N*.

{{%/selector%}}

{{%selector id="number-gt" text=">N"%}}

Matches numbers that are greater than *N*.

{{%/selector%}}

{{%selector id="number-ge" text=">=N"%}}

Matches numbers that are greater than or equal to *N*.

{{%/selector%}}

{{%selector id="number-range" text="N..M"%}}

Matches numbers that are greater than or equal to *N* and less than or equal to
*M*.

{{%/selector%}}
</dl>

Also includes the [anything](#selector-any) component.

### Bool
Compares against boolean values.

<dl>
{{%selector id="false-0" text="0" /%}}
{{%selector id="false-no" text="no" /%}}
{{%selector id="false" text="false" /%}}
{{%selector id="false-n" text="n" /%}}
{{%selector id="false-f" text="f"%}}

Matches values that are false.

{{%/selector%}}

{{%selector id="true-1" text="1" /%}}
{{%selector id="true-yes" text="yes" /%}}
{{%selector id="true" text="true" /%}}
{{%selector id="true-y" text="y" /%}}
{{%selector id="true-t" text="t"%}}

Matches values that are true.

{{%/selector%}}
</dl>

Also includes the [anything](#selector-any) component.

### Anything
<dl>
{{%selector id="any" text="*"%}}

Matches anything. Included by the [string](#string), [number](#number), and
[bool](#bool) components.

{{%/selector%}}
</dl>


## Whitespace
Whitespace between selectors can contain any unicode space characters, including
newlines. Whitespace may also contain comments:

<dl>
{{%selector id="comment" text="#{comment}#"%}}

Indicates an arbitrary block-comment. Is considered whitespace.

{{%/selector%}}
</dl>
