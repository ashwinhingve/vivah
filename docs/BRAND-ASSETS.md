# Smart Shaadi Brand Assets

## AI Portrait Generation

Five hero carousel portraits generated 2026-05-25 for the landing page.
Style: matrimonial profile photography with warm natural light and cultural
authenticity. Each ships with overlay typography (name, age, location,
profession) burned into the image; `HeroCarousel.client.tsx` renders the
WebP directly with no separate text layer.

### Visual style rules (mandatory for future generations)

- 4:5 aspect ratio (480×600px output WebP @ q88)
- Warm natural lighting (window light, golden hour indoor)
- Soft Indian aesthetic, region-appropriate attire
- Subtle warm background, never plain white
- Gentle confident expression, slight smile
- Looking at camera, professional headshot framing
- DSLR photography quality, not phone-cam

### Avoid in negative prompts

- Stock photo feel, plastic skin texture
- Oversaturated colors, over-edited skin
- Glamour / Bollywood / model agency aesthetic
- Fake-looking smiles, exaggerated expressions
- Studio lighting, flat white backgrounds
- Anything reading as "AI obvious"

### Per-region attire references

- **South India** (Bangalore, Hyderabad, Chennai): Modern professional with
  subtle traditional touches (block-print kurti, minimal gold jewelry)
- **West India** (Pune, Mumbai, Ahmedabad): Cosmopolitan or traditional
  Gujarati/Marathi (saree with subtle prints)
- **North India** (Delhi, Lucknow, Jaipur): Cosmopolitan or subtle traditional
  (anarkali, modern fusion)

## The Original Five Portraits

Generated 2026-05-25 — [fill generator tool + cost]

| # | Name | Age | City | Profession | Setting | Attire | File |
|---|------|-----|------|------------|---------|--------|------|
| 1 | Ananya Iyer    | 25 | Bangalore | Software Engineer | Home interior, warm lamp, plant, picture frames | Sage green block-print kurti | `/public/hero/ananya-iyer.webp` |
| 2 | Riya Sharma    | 27 | Pune      | Doctor            | Subtle clinic background with greenery          | White doctor coat over dusty pink top, stethoscope | `/public/hero/riya-sharma.webp` |
| 3 | Priya Reddy    | 26 | Hyderabad | Architect         | Architecture office with hand-drawn sketches    | Black professional shirt | `/public/hero/priya-reddy.webp` |
| 4 | Anjali Kapoor  | 28 | Delhi     | Marketing         | Modern office with window light                 | Cream cardigan over white shirt, delicate necklace | `/public/hero/anjali-kapoor.webp` |
| 5 | Sneha Patel    | 25 | Ahmedabad | CA                | Home with wooden furniture, plants, picture frame | Cream floral-print saree, small bindi, gold earrings | `/public/hero/sneha-patel.webp` |

## Future Portrait Additions

Use the same style rules as templates. Vary:

- **Age range** — 24–35 for matrimonial primary, 50–65 for parent portraits
- **Profession** — engineer, doctor, business, creative, civil services, teacher
- **Region** — cover all major Indian cities for diversity
- **Family setup** — single individual, sibling pair, with parents

### File naming convention

- Profile portraits: `/public/hero/{first-name-kebab}-{last-name-kebab}.webp`
- Non-profile brand imagery: `/public/brand/{purpose}-{variant}.webp`

### Required disclosure

Every surface that renders an AI-generated demo profile must display
`AI-generated demo profiles · Real profiles are verified` somewhere
contextual (currently rendered below the HeroCarousel dot indicators).
