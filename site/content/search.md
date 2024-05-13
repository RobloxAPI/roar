+++
title = "Search cheat sheet"
summary = "Cheat sheet for advanced searching."
+++

A search query is an expression made up of a number of **selectors**. When
searching, selectors are matched against each API entity.

*~~Crossed out~~ selectors are not yet implemented.*

## Name selectors
The name selectors are the most simple, comparing against the names of entities.

<dl>
{{%selector id="name-fuzzy" text="foo"%}}

Selects entities whose name matches *foo*. Selection is case-insensitive, and
based on a fuzzy matching algorithm.
{{%/selector%}}

{{%selector id="name-sub" text="'foo'"%}}

Selects entities whose name is contains the case-sensitive sub-string *foo*.
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

In general, each name selector is a [string selector](#string-selectors) that
matches against entity names.

## Compound selector
The compound selector divides entity types into two categories. **Primary**
entities include classes, enums, and types. **Secondary** entities include
properties, functions, events, callbacks, and enum items.

<dl>
{{%selector id="compound" text="foo.bar"%}}

Selects entities whose corresponding primary name matches *foo* and secondary
name matches *bar*.

{{%/selector%}}

{{%selector id="compound-primary" text="foo."%}}

Selects only primary entities whose name matches *foo*.
{{%/selector%}}

{{%selector id="compound-secondary" text=".bar"%}}

Selects only secondary entities whose name matches *bar*.
{{%/selector%}}
</dl>

Each component is a [string selector](#string-selectors). That is, an expression
like `"foo"./bar/` is valid.

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

## Type selector
The `is:` selector can be used to narrow down a search to certain entity types.
Types are case-insensitive. The [`$type`](#selector-meta-type) selector can be
used to list possible types.

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

## Prefix selectors
A prefix selector matches against a particular field of a type of entity. They
have the form `prefix:value`. The prefix part of the selector is
case-insensitive. The value part of each selector may match either a
[string](#string-selectors), [number](#number-selectors), or
[boolean](#bool-selectors).

<dl>
{{%selector id="tag" text="tag:foo"%}}

Selects entities that have tag *foo*. The tag is case-insensitive, but must
otherwise match exactly. The [`$tag`](#selector-meta-tag) selector can be used
to list possible tags.
{{%/selector%}}

{{%selector id="removed" text="removed:yes"%}}

Selects entities that are not present in the current revision of the API
([bool](#bool-selectors)).
{{%/selector%}}

{{%selector id="superclasses" text="superclasses:N"%}}

Selects class entities where the number of superclasses matches *N*
([number](#number-selectors)).
{{%/selector%}}

{{%selector id="subclasses" text="subclasses:N"%}}

Selects class entities where the number of subclasses matches *N*
([number](#number-selectors)).
{{%/selector%}}

{{%selector id="members" text="members:N"%}}

Selects class entities where the number of members matches *N*
([number](#number-selectors)).
{{%/selector%}}

{{%selector id="superclass" text="superclass:foo"%}}

Selects class entities with a superclass whose name matches *foo*
([string](#string-selectors)).
{{%/selector%}}

{{%selector id="subclass" text="subclass:foo"%}}

Selects class entities with a subclass whose name matches *foo*
([string](#string-selectors)).
{{%/selector%}}

{{%selector id="memcat" text="memcat:foo"%}}

Selects class entities where the memory category matches *foo*
([string](#string-selectors)).
{{%/selector%}}

{{%selector id="threadsafety" text="threadsafety:foo"%}}

Selects member entities where the thread safety matches *foo*
([string](#string-selectors)). The
[`$threadsafety`](#selector-meta-threadsafety) selector can be used to list
possible values.
{{%/selector%}}

{{%selector id="security" text="security:foo"%}}

Selects function, event, and callback entities where the security matches *foo*,
or property entities where the read security matches *foo*
([string](#string-selectors)). The [`$security`](#selector-meta-security)
selector can be used to list possible values.
{{%/selector%}}

{{%selector id="cansave" text="cansave:yes"%}}

Selects property entities that can be serialized ([bool](#bool-selectors)).
{{%/selector%}}

{{%selector id="canload" text="canload:yes"%}}

Matches property entities that can be deserialized ([bool](#bool-selectors)).
{{%/selector%}}

{{%selector id="readsecurity" text="readsecurity:foo"%}}

Selects property entities where the read security matches *foo*
([string](#string-selectors)). The [`$security`](#selector-meta-security)
selector can be used to list possible values.
{{%/selector%}}

{{%selector id="writesecurity" text="writesecurity:foo"%}}

Selects property entities where the write security matches *foo*
([string](#string-selectors)). The [`$security`](#selector-meta-security)
selector can be used to list possible values.
{{%/selector%}}

{{%selector id="valuetypecat" text="valuetypecat:foo"%}}

Selects property entities where the category of the value type matches *foo*
([string](#string-selectors)). The [`$typecat`](#selector-meta-typecat) selector
can be used to list possible values.
{{%/selector%}}

{{%selector id="valuetypename" text="valuetypename:foo"%}}

Selects property entities where the name of the value type matches *foo*
([string](#string-selectors)).
{{%/selector%}}

{{%selector id="category" text="category:foo"%}}

Selects property entities where the category matches *foo*
([string](#string-selectors)).
{{%/selector%}}

{{%selector id="default" text="default:foo"%}}

Selects property entities where the default value matches *foo*
([number](#number-selectors) or [string](#string-selectors)).
{{%/selector%}}

{{%selector id="returns" text="returns:N"%}}

Selects function and callback entities where the number of return values matches
*N* ([number](#number-selectors)).
{{%/selector%}}

{{%selector id="parameters" text="parameters:N"%}}

Selects function, event, and callback entities where the number of parameters
matches *N* ([number](#number-selectors)).
{{%/selector%}}

{{%selector id="returntypecat" text="returntypecat:foo"%}}

Selects function and callback entities where the category of a return type
matches *foo* ([string](#string-selectors)). The
[`$typecat`](#selector-meta-typecat) selector can be used to list possible
values.
{{%/selector%}}

{{%selector id="returntypename" text="returntypename:foo"%}}

Selects function and callback entities where the name of a return type matches
*foo* ([string](#string-selectors)).
{{%/selector%}}

{{%selector id="returntypeopt" text="returntypeopt:yes"%}}

Selects function and callback entities where a return type is optional
([bool](#bool-selectors)).
{{%/selector%}}

{{%selector id="paramtypecat" text="paramtypecat:foo"%}}

Selects function, event, and callback entities where the category of a parameter
type matches *foo* ([string](#string-selectors)). The
[`$typecat`](#selector-meta-typecat) selector can be used to list possible
values.
{{%/selector%}}

{{%selector id="paramtypename" text="paramtypename:foo"%}}

Selects function, event, and callback entities where the name of a parameter
type matches *foo* ([string](#string-selectors)).
{{%/selector%}}

{{%selector id="paramtypeopt" text="paramtypeopt:yes"%}}

Selects function, event, and callback entities where a parameter is optional.
([bool](#bool-selectors)).
{{%/selector%}}

{{%selector id="paramname" text="paramname:foo"%}}

Selects function, event, and callback entities where the name of a parameter
matches *foo* ([string](#string-selectors)).
{{%/selector%}}

{{%selector id="paramdefault" text="paramdefault:foo"%}}

Selects property entities where the default value of a parameter matches *foo*
([number](#number-selectors) or [string](#string-selectors)).
{{%/selector%}}

{{%selector id="enumitems" text="enumitems:N"%}}

Selects enum entities where the number of enum items matches *N*
([number](#number-selectors)).
{{%/selector%}}

{{%selector id="itemvalue" text="itemvalue:N"%}}

Selects enum item entities where the item value matches *N*
([number](#number-selectors)).
{{%/selector%}}

{{%selector id="legacynames" text="legacynames:N"%}}

Selects enum item entities where the number of legacy names matches *N*
([number](#number-selectors)).
{{%/selector%}}

{{%selector id="legacyname" text="legacyname:foo"%}}

Selects enum item entities where a legacy name matches *foo*
([string](#string-selectors)).
{{%/selector%}}

{{%selector id="typecat" text="typecat:foo"%}}

Selects type entities where the category matches *foo*
([string](#string-selectors)). The [`$typecat`](#selector-meta-typecat) selector
can be used to list possible values.
{{%/selector%}}
</dl>

## Result selectors
Result selectors are used to control search results. These selectors are not
included in the logic of the query expression. The prefix part of the selector
is case-insensitive.

<dl>
{{%selector id="limit" text="limit:N"%}}

Sets the maximum number of results that will be displayed to *N*, which must be
a positive integer. Defaults to 50.
{{%/selector%}}

{{%selector id="sort" text="sort:field" notimplemented="1"%}}

: Sorts search results according to value *field*. Values are case-insensitive.
    Defaults to `sort:score`. The following values are valid:
  - `score`: Sort by score. Defaults to descending.
  - `name`: Sort by entity name. Defaults to ascending.
  - `random`: Shuffle the results randomly.
{{%/selector%}}

{{%selector id="sort-asc" text="sort:<field" notimplemented="1"%}}

Force *field* to sort ascending.
{{%/selector%}}

{{%selector id="sort-desc" text="sort:>field" notimplemented="1"%}}

Force *field* to sort descending.
{{%/selector%}}

{{%selector id="go" text="go:location" notimplemented="1"%}}

If included, the page will immediately redirect to the page at *location*
corresponding to the first search result. Locations are case-insensitive. The
following locations are valid:
- `here`: Redirects to the page on this website.
- `hub`: Redirects to the corresponding Creator Hub page.
- `docs`: Redirects to the corresponding file in the creator-docs repository.
{{%/selector%}}
</dl>

## Meta selectors
The inclusion of a meta selector causes certain values to be listed in the
search results. These selectors are not included in the logic of the query
expression. Their names are case-insensitive.

<dl>
{{%selector id="meta-type" text="$type"%}}

Lists each type of entity.
{{%/selector%}}

{{%selector id="meta-tag" text="$tag"%}}

Lists the name of each tag. These names can be used with the
[`tag`](#selector-tag) selector.
{{%/selector%}}

{{%selector id="meta-security" text="$security"%}}

Lists possible values for the Security field of member entities. These can be
used with the [`security`](#selector-security),
[`readsecurity`](#selector-readsecurity), and
[`writesecurity`](#selector-writesecurity) selectors.
{{%/selector%}}

{{%selector id="meta-threadsafety" text="$threadsafety"%}}

Lists possible values for the ThreadSafety field of member entities. These can
be used with the [`threadsafety`](#selector-threadsafety) selector.
{{%/selector%}}

{{%selector id="meta-typecat" text="$typecat"%}}

Lists possible values for the Category field of type entities. These can be used
with the [`typecat`](#selector-typecat) selector.
{{%/selector%}}
</dl>

## String selectors
String selectors compare against string-like values. They form components of
more specific selectors.

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

{{%selector id="string-any" text="*"%}}

Matches anything.
{{%/selector%}}
</dl>

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

## Number selectors
Number selectors compare against numeric values. They form components of more
specific selectors.

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
</dl>

## Bool selectors
Bool selectors compare against boolean values. They form components of more
specific selectors.

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

## Comments
Whitespace between selectors can contain any unicode space characters, including
newlines. Whitespace may contain comments:

<dl>
{{%selector id="comment" text="#{comment}#"%}}

Indicates an arbitrary block-comment. Is considered whitespace.
{{%/selector%}}
</dl>
