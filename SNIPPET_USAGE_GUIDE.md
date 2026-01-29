# Detective Snippet Usage Guide

## Quick Start

### 1. Import the Component
```tsx
import { DetectiveSnippetGrid } from "@/components/snippets/detective-snippet-grid";
```

### 2. Use with Direct Parameters
```tsx
export default function MyPage() {
  return (
    <div className="container py-8">
      <h2 className="text-2xl font-bold mb-6">
        Best Detectives in Bangalore
      </h2>
      <DetectiveSnippetGrid
        country="India"
        state="Karnataka"
        city="Bangalore"
        category="Cyber Crime"
        limit={4}
      />
    </div>
  );
}
```

### 3. Use with Saved Snippet ID
```tsx
export default function MyPage() {
  return (
    <div className="container py-8">
      <h2 className="text-2xl font-bold mb-6">
        Featured Detectives
      </h2>
      <DetectiveSnippetGrid snippetId="uuid-here" />
    </div>
  );
}
```

---

## Component Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `snippetId` | string | No | - | Use saved snippet config instead of direct params |
| `country` | string | Yes* | - | Country name (e.g., "India") |
| `state` | string | No | - | State/region name |
| `city` | string | No | - | City name |
| `category` | string | Yes* | - | Service category name |
| `limit` | number | No | 4 | Number of results to display (1-20) |

**Note:** Use either `snippetId` OR (`country` + `category`). If `snippetId` is provided, other parameters are ignored.

---

## Real-World Examples

### Example 1: Home Page - Featured Detectives by Category
```tsx
// pages/home.tsx
import { DetectiveSnippetGrid } from "@/components/snippets/detective-snippet-grid";

export default function HomePage() {
  return (
    <>
      {/* ... other sections ... */}
      
      <section className="py-12 bg-gray-50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold mb-2">
            Expert Detectives Across India
          </h2>
          <p className="text-gray-600 mb-8">
            Browse verified detectives specializing in different services
          </p>
          
          {/* Cyber Crime Specialists */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold mb-6">
              Cyber Crime Specialists
            </h3>
            <DetectiveSnippetGrid
              country="India"
              category="Cyber Crime"
              limit={8}
            />
          </div>

          {/* Corporate Investigation */}
          <div className="mb-12">
            <h3 className="text-xl font-semibold mb-6">
              Corporate Investigators
            </h3>
            <DetectiveSnippetGrid
              country="India"
              category="Corporate Investigation"
              limit={8}
            />
          </div>
        </div>
      </section>
    </>
  );
}
```

### Example 2: Category Page - Location-Specific Results
```tsx
// pages/categories.tsx
import { useRoute } from "wouter";
import { DetectiveSnippetGrid } from "@/components/snippets/detective-snippet-grid";

export default function CategoryPage() {
  const [match, params] = useRoute("/categories/:slug");
  
  if (!match) return <NotFound />;
  
  const category = params.slug; // e.g., "cyber-crime"
  
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2 capitalize">
        {category.replace(/-/g, " ")}
      </h1>
      
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-6">
          Available in Your Region
        </h2>
        <DetectiveSnippetGrid
          country="India"
          category={category}
          limit={12}
        />
      </div>
    </div>
  );
}
```

### Example 3: State/City Page - Regional Results
```tsx
// pages/regions/[state]/[city].tsx
import { DetectiveSnippetGrid } from "@/components/snippets/detective-snippet-grid";
import { COUNTRY_STATES } from "@/lib/geo";

export default function CityPage({ state, city }) {
  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2">
        Detectives in {city}, {state}
      </h1>
      <p className="text-gray-600 mb-8">
        Find trusted detectives serving your area
      </p>
      
      <div className="grid gap-12">
        {/* Show all categories for this city */}
        {["Cyber Crime", "Corporate Investigation", "Personal", "Fraud"].map(
          (category) => (
            <div key={category}>
              <h2 className="text-xl font-semibold mb-6">
                {category} Specialists
              </h2>
              <DetectiveSnippetGrid
                country="India"
                state={state}
                city={city}
                category={category}
                limit={4}
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}
```

### Example 4: Using Saved Snippets (Admin-Created)
```tsx
// pages/featured.tsx
// Admin created snippets with IDs: "snippet-1", "snippet-2", "snippet-3"

export default function FeaturedPage() {
  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold mb-12">
        Featured Detective Collections
      </h1>
      
      <div className="space-y-16">
        <section>
          <h2 className="text-2xl font-semibold mb-6">
            Top Cyber Crime Experts - Bangalore
          </h2>
          <DetectiveSnippetGrid snippetId="snippet-1" />
        </section>
        
        <section>
          <h2 className="text-2xl font-semibold mb-6">
            Corporate Investigators - Mumbai
          </h2>
          <DetectiveSnippetGrid snippetId="snippet-2" />
        </section>
        
        <section>
          <h2 className="text-2xl font-semibold mb-6">
            Personal Services - Delhi
          </h2>
          <DetectiveSnippetGrid snippetId="snippet-3" />
        </section>
      </div>
    </div>
  );
}
```

---

## Admin Workflow

### Creating a Snippet

1. **Navigate to Admin > Snippets**
   - Menu: Left sidebar → "Snippets"
   - URL: `/admin/snippets`

2. **Fill the Form**
   - **Name:** "Bangalore Cyber Crime Detectives"
   - **Country:** Select "India" from dropdown
   - **State:** Select "Karnataka" from dropdown (optional)
   - **City:** Type "Bangalore" (optional)
   - **Category:** Select "Cyber Crime" from dropdown
   - **Limit:** Set to "4" (or desired count)

3. **Create Snippet**
   - Click "Create Snippet" button
   - Snippet saved to database

4. **Preview Results**
   - Click eye icon next to snippet in the list
   - See live detective cards matching criteria
   - Verify results are correct

5. **Edit or Delete**
   - Click edit icon to modify configuration
   - Click trash icon to delete permanently

---

## Admin-Created Snippets Table

After creating snippets, you'll see them listed:

```
Saved Snippets (3)
┌─────────────────────────────────────────────────────────┐
│ Bangalore Cyber Crime                                   │
│ India, Karnataka, Bangalore • Cyber Crime • 4 results  │
│ [Eye] [Edit] [Delete]                                  │
├─────────────────────────────────────────────────────────┤
│ Mumbai Corporate Investigators                          │
│ India, Maharashtra, Mumbai • Corporate Investigation •  │
│ [Eye] [Edit] [Delete]                                  │
├─────────────────────────────────────────────────────────┤
│ Delhi Personal Services                                │
│ India, Delhi • Personal Services • 8 results           │
│ [Eye] [Edit] [Delete]                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Getting Snippet IDs

### Method 1: From Admin Page
1. Navigate to `/admin/snippets`
2. Create or find a snippet
3. Look at the URL when editing: `/admin/snippets?edit=<SNIPPET_ID>`
4. Copy the ID

### Method 2: From Browser Console
```javascript
// Fetch all snippets
fetch('/api/snippets').then(r => r.json()).then(d => console.log(d.snippets));

// Copy the ID from output
// [
//   { id: "abc-123-def", name: "Bangalore Cyber Crime", ... },
//   ...
// ]
```

### Method 3: From Database
```sql
-- SSH into Supabase and run:
SELECT id, name, country, state, city, category FROM detective_snippets;

-- Result:
-- id                 | name                       | country | state      | city
-- abc-123-def        | Bangalore Cyber Crime      | India   | Karnataka  | Bangalore
```

---

## Styling & Customization

The component uses the existing `ServiceCard` component, which means it inherits all styling from your search results page:

```tsx
// Component output HTML structure
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  <ServiceCard {...cardData} />
  <ServiceCard {...cardData} />
  <ServiceCard {...cardData} />
  <ServiceCard {...cardData} />
</div>
```

**Grid Breakpoints:**
- Mobile: 1 column
- Tablet (md): 2 columns
- Desktop (lg): 4 columns

**To customize:**
```tsx
// Modify component props or wrap with custom styles
<div className="my-custom-wrapper">
  <DetectiveSnippetGrid
    country="India"
    category="Cyber Crime"
    limit={6}
  />
</div>
```

---

## Troubleshooting

### No detectives shown
- ✅ Verify detectives exist in database with `status = 'active'`
- ✅ Check category name matches exactly (case-sensitive)
- ✅ Verify detectives have at least one service in that category

### Wrong results displayed
- ✅ Verify country/state/city values are spelled correctly
- ✅ Check that `state` and `city` match database records
- ✅ Use browser DevTools to inspect API response

### Performance slow
- ✅ Reduce `limit` number
- ✅ Use specific `state`/`city` instead of country-wide
- ✅ Check database indexes are created

---

## Best Practices

✅ **Do:**
- Use saved snippets for frequently-used configurations
- Create snippets for popular location+category combinations
- Test preview before using in production pages
- Document which pages use which snippets

❌ **Don't:**
- Use snippets on every page (use direct parameters instead)
- Change country/state/city frequently (edit snippet instead)
- Create duplicate snippets with same filters
- Forget to provide both `country` and `category` when not using `snippetId`

---

## API Reference

### GET `/api/snippets/detectives`

**Direct API Usage (Advanced)**

```javascript
const params = new URLSearchParams({
  country: 'India',
  state: 'Karnataka',
  city: 'Bangalore',
  category: 'Cyber Crime',
  limit: '4'
});

fetch(`/api/snippets/detectives?${params}`)
  .then(r => r.json())
  .then(data => {
    console.log(data.detectives);
    // [
    //   {
    //     id: "detective-uuid",
    //     fullName: "John Doe",
    //     level: "level2",
    //     profilePhoto: "https://...",
    //     isVerified: true,
    //     location: "Bangalore, Karnataka",
    //     avgRating: 4.7,
    //     reviewCount: 42,
    //     startingPrice: 5000
    //   },
    //   ...
    // ]
  });
```

---

## Support

For issues or questions:
1. Check SNIPPET_FEATURE_COMPLETE.md for architecture details
2. Review component source: `client/src/components/snippets/detective-snippet-grid.tsx`
3. Check admin page: `client/src/pages/admin/snippets.tsx`
4. Review database: `migrations/0018_create_detective_snippets_table.sql`
