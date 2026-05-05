# Schema & Setting Types Reference

## Table of Contents
1. [All Setting Input Types](#all-setting-input-types)
2. [Block Types & Structure](#block-types--structure)
3. [Presets](#presets)
4. [Section Groups](#section-groups)
5. [Conditional Settings (visible_if)](#conditional-settings-visible_if)
6. [Localization in Schema](#localization-in-schema)
7. [Complete Section Schema Example](#complete-section-schema-example)

---

## All Setting Input Types

### Text Inputs

**text** — Single line text
```json
{
  "type": "text",
  "id": "heading",
  "label": "t:sections.common.heading.label",
  "default": "Featured Collection",
  "placeholder": "Enter heading..."
}
```
Liquid: `{{ section.settings.heading }}`

**textarea** — Multi-line text
```json
{
  "type": "textarea",
  "id": "description",
  "label": "Description",
  "default": "Browse our latest products"
}
```
Liquid: `{{ section.settings.description }}`

**richtext** — Rich text with basic formatting
```json
{
  "type": "richtext",
  "id": "body_text",
  "label": "Body text",
  "default": "<p>Welcome to our store</p>"
}
```
Liquid: `{{ section.settings.body_text }}` (outputs HTML, already safe)

**inline_richtext** — Inline rich text (no block elements)
```json
{
  "type": "inline_richtext",
  "id": "subtitle",
  "label": "Subtitle",
  "default": "Shop <em>now</em>"
}
```

**html** — Raw HTML input
```json
{
  "type": "html",
  "id": "custom_html",
  "label": "Custom HTML"
}
```

**liquid** — Raw Liquid input
```json
{
  "type": "liquid",
  "id": "custom_liquid",
  "label": "Custom Liquid"
}
```

### Number Inputs

**number** — Integer input
```json
{
  "type": "number",
  "id": "items_per_row",
  "label": "Items per row",
  "default": 4
}
```

**range** — Slider input
```json
{
  "type": "range",
  "id": "padding_top",
  "min": 0,
  "max": 100,
  "step": 4,
  "unit": "px",
  "label": "Top padding",
  "default": 36
}
```

### Selection Inputs

**checkbox** — Boolean toggle
```json
{
  "type": "checkbox",
  "id": "show_vendor",
  "label": "Show vendor",
  "default": false
}
```
Liquid: `{% if section.settings.show_vendor %}...{% endif %}`

**select** — Dropdown
```json
{
  "type": "select",
  "id": "layout",
  "label": "Layout",
  "default": "grid",
  "options": [
    { "value": "grid", "label": "Grid" },
    { "value": "list", "label": "List" },
    { "value": "carousel", "label": "Carousel" }
  ]
}
```

**radio** — Radio buttons (visible options)
```json
{
  "type": "radio",
  "id": "alignment",
  "label": "Alignment",
  "default": "left",
  "options": [
    { "value": "left", "label": "Left" },
    { "value": "center", "label": "Center" },
    { "value": "right", "label": "Right" }
  ]
}
```

### Media Inputs

**image_picker** — Image selector
```json
{
  "type": "image_picker",
  "id": "background_image",
  "label": "Background image"
}
```
Liquid:
```liquid
{% if section.settings.background_image != blank %}
  {{ section.settings.background_image | image_url: width: 1200 | image_tag:
     loading: 'lazy',
     sizes: '100vw',
     widths: '600,900,1200,1800' }}
{% endif %}
```

**video** — Shopify-hosted video
```json
{
  "type": "video",
  "id": "promo_video",
  "label": "Video"
}
```

**video_url** — YouTube/Vimeo URL
```json
{
  "type": "video_url",
  "id": "video_url",
  "label": "Video URL",
  "accept": ["youtube", "vimeo"]
}
```

### Style Inputs

**color** — Color picker
```json
{
  "type": "color",
  "id": "text_color",
  "label": "Text color",
  "default": "#121212"
}
```

**color_background** — Gradient or solid color
```json
{
  "type": "color_background",
  "id": "background",
  "label": "Background"
}
```

**color_scheme** — Theme color scheme selector
```json
{
  "type": "color_scheme",
  "id": "color_scheme",
  "label": "Color scheme",
  "default": "scheme-1"
}
```

**color_scheme_group** — (settings_schema.json only) Defines available color schemes

**font_picker** — Font selector
```json
{
  "type": "font_picker",
  "id": "heading_font",
  "label": "Heading font",
  "default": "helvetica_n4"
}
```
Liquid:
```liquid
{% style %}
  {{ section.settings.heading_font | font_face }}
  .section-heading { font-family: {{ section.settings.heading_font.family }}, {{ section.settings.heading_font.fallback_families }}; }
{% endstyle %}
```

### Resource Inputs

**url** — URL picker (internal pages, external URLs)
```json
{
  "type": "url",
  "id": "button_link",
  "label": "Button link"
}
```

**product** — Product picker
```json
{
  "type": "product",
  "id": "featured_product",
  "label": "Featured product"
}
```
Liquid: `{% assign product = section.settings.featured_product %}`

**collection** — Collection picker
```json
{
  "type": "collection",
  "id": "collection",
  "label": "Collection"
}
```

**product_list** — Multiple products
```json
{
  "type": "product_list",
  "id": "products",
  "label": "Products",
  "limit": 12
}
```

**collection_list** — Multiple collections
```json
{
  "type": "collection_list",
  "id": "collections",
  "label": "Collections",
  "limit": 6
}
```

**blog** — Blog picker
```json
{
  "type": "blog",
  "id": "blog",
  "label": "Blog"
}
```

**page** — Page picker
```json
{
  "type": "page",
  "id": "page",
  "label": "Page"
}
```

**article** — Article picker
```json
{
  "type": "article",
  "id": "article",
  "label": "Article"
}
```

**link_list** — Navigation menu picker
```json
{
  "type": "link_list",
  "id": "menu",
  "label": "Menu",
  "default": "main-menu"
}
```

**metaobject_reference** — Metaobject picker
```json
{
  "type": "metaobject_reference",
  "id": "testimonial",
  "label": "Testimonial",
  "metaobject_type": "testimonial"
}
```

### Display-Only Types (no ID)

**header** — Visual separator in editor
```json
{
  "type": "header",
  "content": "Layout settings"
}
```

**paragraph** — Info text in editor
```json
{
  "type": "paragraph",
  "content": "Choose how products are displayed in this section."
}
```

---

## Block Types & Structure

### Section Blocks (defined in section schema)
```json
"blocks": [
  {
    "type": "text_block",
    "name": "Text",
    "limit": 3,
    "settings": [
      {
        "type": "richtext",
        "id": "text",
        "label": "Text",
        "default": "<p>Share information</p>"
      }
    ]
  },
  {
    "type": "image_block",
    "name": "Image",
    "settings": [
      {
        "type": "image_picker",
        "id": "image",
        "label": "Image"
      }
    ]
  }
]
```

Liquid rendering:
```liquid
{%- for block in section.blocks -%}
  <div class="my-section__block" {{ block.shopify_attributes }}>
    {%- case block.type -%}
      {%- when 'text_block' -%}
        <div class="my-section__text">
          {{ block.settings.text }}
        </div>
      {%- when 'image_block' -%}
        {% if block.settings.image != blank %}
          {{ block.settings.image | image_url: width: 600 | image_tag: loading: 'lazy' }}
        {% endif %}
    {%- endcase -%}
  </div>
{%- endfor -%}
```

**Important:** Always include `{{ block.shopify_attributes }}` on the block's wrapper element. This enables theme editor features like click-to-select and block reordering.

### App Blocks (@app)
Support app blocks in key sections:
```json
"blocks": [
  {
    "type": "@app"
  },
  {
    "type": "text_block",
    "name": "Text",
    "settings": [...]
  }
]
```

Liquid:
```liquid
{%- for block in section.blocks -%}
  {%- case block.type -%}
    {%- when '@app' -%}
      {% render block %}
    {%- when 'text_block' -%}
      {{ block.settings.text }}
  {%- endcase -%}
{%- endfor -%}
```

### Theme Blocks (@theme)
Recommended blocks that the theme editor auto-populates:
```json
"blocks": [
  {
    "type": "@theme"
  }
]
```

### max_blocks
Maximum 50 blocks per section (Shopify hard limit). Set a lower `limit` on the blocks array or individual block types when appropriate.

### Dynamic Block Titles
Shopify auto-generates block titles from settings in this order of precedence:
1. Setting named `heading`
2. Setting named `title`
3. Setting named `text`

Name your primary text setting accordingly to get useful block labels in the editor.

---

## Presets

Presets define how a section appears in "Add section" menu. Without presets, a section can only be used in JSON templates — merchants can't add it dynamically.

```json
"presets": [
  {
    "name": "t:sections.featured_collection.presets.name",
    "category": "t:sections.categories.collection",
    "settings": {
      "heading": "Shop the Collection",
      "products_to_show": 8
    },
    "blocks": [
      { "type": "product_card" },
      { "type": "product_card" },
      { "type": "product_card" }
    ]
  }
]
```

- `name`: displayed in the "Add section" menu. Use translation keys.
- `category`: groups sections in the menu (optional but recommended)
- `settings`: pre-configured setting values (optional)
- `blocks`: pre-populated blocks (optional)

---

## Section Groups

Section groups are JSON files that define global sections (header, footer, overlays):

```json
// sections/header-group.json
{
  "type": "header",
  "name": "t:sections.header.name",
  "sections": {
    "announcement": {
      "type": "announcement-bar",
      "settings": {}
    },
    "header": {
      "type": "header",
      "settings": {}
    }
  },
  "order": ["announcement", "header"]
}
```

Loaded in layout via `{% sections 'header-group' %}`.

Types: `header`, `footer`, `aside`, `custom.*`

---

## Conditional Settings (visible_if)

Show/hide settings based on other setting values:

```json
{
  "type": "select",
  "id": "layout",
  "label": "Layout",
  "default": "grid",
  "options": [
    { "value": "grid", "label": "Grid" },
    { "value": "carousel", "label": "Carousel" }
  ]
},
{
  "type": "range",
  "id": "columns",
  "label": "Columns",
  "min": 2,
  "max": 6,
  "default": 4,
  "visible_if": "{{ layout }} == grid"
},
{
  "type": "checkbox",
  "id": "autoplay",
  "label": "Autoplay",
  "default": false,
  "visible_if": "{{ layout }} == carousel"
}
```

---

## Localization in Schema

Use translation keys for all user-facing strings:

```json
{
  "name": "t:sections.featured_collection.name",
  "settings": [
    {
      "type": "text",
      "id": "heading",
      "label": "t:sections.featured_collection.settings.heading.label",
      "info": "t:sections.featured_collection.settings.heading.info",
      "default": "t:sections.featured_collection.settings.heading.default"
    }
  ],
  "presets": [
    {
      "name": "t:sections.featured_collection.presets.name"
    }
  ]
}
```

Locale file structure:
```json
{
  "sections": {
    "featured_collection": {
      "name": "Featured Collection",
      "settings": {
        "heading": {
          "label": "Heading",
          "info": "The main heading for this section",
          "default": "Featured Collection"
        }
      },
      "presets": {
        "name": "Featured Collection"
      }
    }
  }
}
```

Limits: max 3400 translations per locale file, max 1000 characters per value.

---

## Complete Section Schema Example

```json
{
  "name": "t:sections.featured_collection.name",
  "tag": "section",
  "class": "section-featured-collection",
  "limit": 2,
  "disabled_on": {
    "groups": ["header", "footer"]
  },
  "settings": [
    {
      "type": "header",
      "content": "t:sections.featured_collection.settings.header_content.content"
    },
    {
      "type": "text",
      "id": "heading",
      "label": "t:sections.featured_collection.settings.heading.label",
      "default": "Featured Collection"
    },
    {
      "type": "collection",
      "id": "collection",
      "label": "t:sections.featured_collection.settings.collection.label"
    },
    {
      "type": "range",
      "id": "products_to_show",
      "min": 2,
      "max": 12,
      "step": 1,
      "default": 4,
      "label": "t:sections.featured_collection.settings.products_to_show.label"
    },
    {
      "type": "select",
      "id": "layout",
      "label": "t:sections.featured_collection.settings.layout.label",
      "default": "grid",
      "options": [
        { "value": "grid", "label": "Grid" },
        { "value": "carousel", "label": "Carousel" }
      ]
    },
    {
      "type": "header",
      "content": "t:sections.common.settings.section_padding.content"
    },
    {
      "type": "range",
      "id": "padding_top",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "label": "t:sections.common.settings.padding_top.label",
      "default": 36
    },
    {
      "type": "range",
      "id": "padding_bottom",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "label": "t:sections.common.settings.padding_bottom.label",
      "default": 36
    }
  ],
  "blocks": [
    {
      "type": "@app"
    },
    {
      "type": "product_card",
      "name": "t:sections.featured_collection.blocks.product_card.name",
      "settings": [
        {
          "type": "checkbox",
          "id": "show_vendor",
          "label": "t:sections.featured_collection.blocks.product_card.settings.show_vendor.label",
          "default": false
        },
        {
          "type": "checkbox",
          "id": "show_price",
          "label": "t:sections.featured_collection.blocks.product_card.settings.show_price.label",
          "default": true
        }
      ]
    }
  ],
  "presets": [
    {
      "name": "t:sections.featured_collection.presets.name",
      "category": "t:sections.categories.collection"
    }
  ]
}
```
