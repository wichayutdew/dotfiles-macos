---
name: coding-standards
description: Coding philosophy and language patterns — immutability-first, functional over OOP. Load before writing or reviewing any code.
---

# Coding Standards

consult with `context7` and `agoda_skills` when you are unsure with some coding best practice

## Principles (in priority order)

1. **Immutability first** — `val` over `var`, `const` over `let`, no setters
2. **Pure functions** — same input → same output, no side effects in core logic
3. **Composition over inheritance** — build from small functions, not class hierarchies
4. **Pattern matching over if/else** — `when`, `match`, sealed types
5. **Expressions over statements** — every construct should return a value
6. **Higher-order functions over loops** — `map`, `filter`, `fold`, `flatMap`

## Per Language

| Language | Immutable data | Error type | Collections |
|----------|---------------|-----------|-------------|
| Kotlin | `data class`, `val` | `Result<T>` / sealed | `listOf`, `mapOf` |
| Scala | `case class`, `val` | `Either[E, A]` | `Seq`, `Map` |
| Java | `record`, no setters | `Optional` / sealed | `List.of`, `Map.of` |
| TypeScript | `readonly`, `as const` | discriminated union | `readonly` arrays |

## Anti-patterns to avoid

- `var` / `let` / mutable fields
- OOP with setters and internal state mutation
- `null` returns (use `Option`/`Optional`/`null` type)
- Swallowed exceptions (`catch (e) {}`)
- `any` type in TypeScript
- non-functional whitespace changes unrelated to logic — leave as-is.
  Whitespace-only diffs confuse reviewers and hurt maintainability.

---

## Patterns by Language

## Kotlin

```kotlin
// Pure function
fun calculateTotal(items: List<Item>): BigDecimal =
    items.map { it.price }.fold(BigDecimal.ZERO, BigDecimal::add)

// Sealed class + when
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Failure(val error: AppError) : Result<Nothing>()
}
fun <T, R> Result<T>.map(f: (T) -> R): Result<R> = when (this) {
    is Result.Success -> Result.Success(f(data))
    is Result.Failure -> this
}

// Pipeline
fun processUsers(users: List<User>): List<ProcessedUser> =
    users.filter { it.email.contains("@") }
         .sortedBy { it.name }
         .map { it.toProcessedUser() }

// Service layer: pure logic in object, side effects in service
object CsvGenerator {
    fun generate(users: List<User>): ByteArray = /* pure */ ...
}
@Service
class UserExportService(private val repo: UserRepository) {
    suspend fun export(): Result<ByteArray> =
        runCatching { repo.findAll() }.map(CsvGenerator::generate)
}
```

## Scala

```scala
// For comprehension (monadic chaining)
def createOrder(req: OrderRequest): Either[AppError, Order] =
  for {
    user    <- userRepo.findById(req.userId).toRight(NotFound("User"))
    product <- productRepo.findById(req.productId).toRight(NotFound("Product"))
    order   <- orderRepo.create(Order(user, product))
  } yield order

// Pattern matching
def process(result: Either[AppError, User]): Response = result match {
  case Right(user)              => Response.ok(user.toJson)
  case Left(NotFound(msg))      => Response.notFound(msg)
  case Left(ValidationError(m)) => Response.badRequest(m)
}

// Pure companion object
object CsvGenerator {
  def generate(users: Seq[User]): Array[Byte] = ...
}
```

## Java

```java
// Record (immutable data)
public record User(Long id, String name, String email) {
    public User withName(String name) { return new User(id, name, email); }
}

// Stream pipeline
public List<UserDto> getActive(List<User> users) {
    return users.stream()
        .filter(User::isActive)
        .sorted(comparing(User::name))
        .map(UserDto::fromUser)
        .toList();
}

// Sealed interface for ADT (Java 17+)
public sealed interface Result<T> permits Success, Failure {}
public record Success<T>(T value) implements Result<T> {}
public record Failure<T>(String error) implements Result<T> {}
```

## TypeScript / React

```typescript
// Discriminated union
type Result<T> = { type: 'success'; data: T } | { type: 'failure'; error: string };

// Pure functions
const calculateTotal = (items: readonly Item[]): number =>
  items.reduce((sum, item) => sum + item.price, 0);

// Immutable update
const updateUser = (user: User, patch: Partial<User>): User => ({ ...user, ...patch });

// React: functional component + hooks
const UserList: React.FC<Props> = ({ users }) => {
  const active = useMemo(() => users.filter(u => u.active), [users]);
  const handleDelete = useCallback((id: number) =>
    setUsers(prev => prev.filter(u => u.id !== id)), []);
  return <ul>{active.map(u => <UserItem key={u.id} user={u} onDelete={handleDelete} />)}</ul>;
};

// Custom hook
const useUsers = () => {
  const [state, setState] = useState<State>({ users: [], loading: true, error: null });
  useEffect(() => {
    fetchUsers()
      .then(users => setState({ users, loading: false, error: null }))
      .catch(e => setState(s => ({ ...s, loading: false, error: e.message })));
  }, []);
  return state;
};
```
