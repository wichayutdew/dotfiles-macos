# Scala Code Style Rules

## 0. General rules

**Naming Convention**

- Please make the name meaningful, don't use x,a,b, or whatever. Make it long if you have to.
- Magic numbers should be put as constants with meaningful names.
- Class file length must be shorter than 500 lines(except the Spec classes).
- Method length should be less than 80 lines.
- Follow Law of Demeter. A class should know only its direct dependencies.
- Always try to explain yourself in code by adding proper comments in the code.
- Related code should appear vertically dense.
- Declare variables close to their usage.
- Dependent and similar functions should be close.
- Every TODO should be accompanied by a Jira tkt.

### Language Rules

- Favour pattern matching over chained if/else for type or value checks.
- Use named and default parameters for clarity and flexibility.
- Use type inference but specify types for public members.
- Prefer for-comprehensions for working with monads (e.g., Option, Future).
- Avoid side effects in pure functions.
- Use expressive, meaningful names for variables and methods.
- Limit method parameter lists to a reasonable size (ideally ≤ 3).
- Use string interpolation (s"...") instead of string concatenation.
- Public functions should have an explicit return type
- Never catch Throwable; catch only NonFatal exceptions to avoid intercepting fatal errors that should crash the process.

## 1. Naming Conventions

- Classes, traits, objects: PascalCase.
- Packages: all-lowercase ASCII.
- Methods, functions, variables: camelCase.
- Constants: ALL_UPPERCASE in companion object.
- Enums, annotations: PascalCase.
- One-character variable names allowed in small, local scope (except 'l').

## 2. Formatting & Structure

- Limit lines to 120 characters.
- Use 2-space indentation.
- One space before/after operators, after commas, after colons.
- No vertical alignment.
- Use one/two blank lines between classes, one blank line between methods.
- No more than two consecutive blank lines.
- Always use curly braces for conditionals/loops (except one-line, side-effect-free ternary).
- Suffix long literals with uppercase `L`.
- Use Java docs style for documentation.
- Group methods logically with comment headers if class is long.

## 3. Imports

- Avoid wildcard imports unless importing more than 6 entities or implicits.
- Use absolute import paths.
- Sort imports: java.*, javax.*, scala.*, third-party, project classes.
- Alphabetize within groups, separate groups with blank lines.

## 4. Method & Class Declarations

- Methods: parentheses unless accessor with no side-effect; callsite matches declaration.
- For multi-line parameter lists, indent parameters 4 spaces, closing parenthesis at line start.
- For class headers not fitting in one line, closing parenthesis and `extends` on next line, no indent.
- Add blank line after method/class header if multi-line.

## 5. Pattern Matching

- For methods with pattern match as body, put `match` on same line as declaration if possible.
- For closures: single case on same line, multiple cases indented and wrapped.
- For type matching, match on type, not expanded arguments.

## 6. Infix & Anonymous Methods

- Use infix notation only for symbolic (operator) methods.
- Avoid excessive parentheses/braces in anonymous methods.

## 7. Case Classes & Immutability

- Case class constructor parameters must not be mutable.
- Use copy constructor for modifications.
- Do not define mutable fields in case classes.

## 8. apply Method

- Do not define apply methods on classes.
- Companion object apply allowed as factory, must return companion class type.

## 9. override Modifier

- Always use override for methods, including abstract method implementations.

## 10. Destructuring Binds

- Do not use destructuring binds in constructors if fields need to be transient.

## 11. Call by Name

- Avoid call-by-name parameters; use `() => T` for deferred computations.

## 12. Multiple Parameter Lists

- Avoid multiple parameter lists except for implicits in low-level libraries.
- Separate explicit and implicit params; each implicit on its own line.
- Avoid implicits unless necessary.

## 13. Type Inference

- Use explicit types for public/implicit methods and for non-obvious variables/closures.

## 14. Recursion

- Avoid recursion unless problem is naturally recursive.
- Use @tailrec for tail-recursive methods.
- Prefer loops and explicit state machines.

## 15. Implicits

- Avoid implicits except for DSLs, implicit type params, or private class use.
- Code must be understandable without reading implicit definition.
- Do not overload implicit methods; each must have a distinct name.
- Do not pass function parameters via implicit parameters.

## 16. Exception Handling

- Do not catch Throwable or Exception; use scala.util.control.NonFatal.
- Handle InterruptedException separately.
- Do not return scala.util.Try in APIs.
- Prefer explicit exception throwing and Java-style try/catch.

## 17. Option Usage

- Use Option for possibly empty values, not null.
- Construct Option with Option(...), not Some(...).
- Do not use None for exceptions; throw explicitly.
- Do not call get on Option unless guaranteed non-empty.

## 18. Monadic Chaining

- Avoid chaining/nesting more than 3 monadic operations.
- Break chain after flatMap.
- Name intermediate results and use explicit types for clarity.

## 19. Concurrency

- Use private[this] for synchronized fields.
- Do not expose synchronization primitives in APIs or callbacks.
- Isolate concurrency logic in small, inner modules.
