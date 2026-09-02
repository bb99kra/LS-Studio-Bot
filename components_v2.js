/**
 * ============================================================================
 * DISCORD COMPONENTS V2 ENGINE & BUILDER CLASSES
 * ============================================================================
 * Official Discord Bot UI Kit / Components V2 Specification Implementation
 * 
 * Supports:
 * - ComponentType: ActionRow(1), Button(2), StringSelect(3), UserSelect(5),
 *   RoleSelect(6), MentionableSelect(7), ChannelSelect(8), Section(9),
 *   TextDisplay(10), Thumbnail(11), MediaGallery(12), File(13),
 *   Separator(14), Container(17).
 * - MessageFlags.IsComponentsV2 = 32768 (1 << 15).
 * - ContainerBuilder: Accent colors (hex/int/named), spoiler, child components.
 * - SectionBuilder: Text displays (1-3) + accessory (Button, Select, Thumbnail).
 * - TextDisplayBuilder: Markdown content, spoiler.
 * - SeparatorBuilder: Divider line (true/false), spacing (small=1, large=2).
 * - MediaGalleryBuilder & MediaGalleryItemBuilder: Media gallery items with URL, description, spoiler.
 * - ThumbnailBuilder: Section accessory thumbnail with URL, description, spoiler.
 * - FileBuilder: Attachment references with attachment:// URL, spoiler.
 * - ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder & OptionBuilder.
 * - Full JSON Serialization (.toJSON()) & Deserialization (.from() / fromJSON()).
 * - Payload helper: createComponentPayload().
 * ============================================================================
 */

'use strict';

// ----------------------------------------------------------------------------
// CONSTANTS & ENUMS
// ----------------------------------------------------------------------------

/**
 * Discord Component Types
 * @enum {number}
 */
const ComponentType = Object.freeze({
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  File: 13,
  Separator: 14,
  Container: 17,
});

/**
 * Discord Message Flags
 * @enum {number}
 */
const MessageFlags = Object.freeze({
  Crossposted: 1 << 0,                      // 1
  IsCrosspost: 1 << 1,                      // 2
  SuppressEmbeds: 1 << 2,                   // 4
  SourceMessageDeleted: 1 << 3,             // 8
  Urgent: 1 << 4,                           // 16
  HasThread: 1 << 5,                        // 32
  Ephemeral: 1 << 6,                        // 64
  Loading: 1 << 7,                          // 128
  FailedToMentionSomeRolesInThread: 1 << 8, // 256
  SuppressNotifications: 1 << 12,           // 4096
  IsVoiceMessage: 1 << 13,                  // 8192
  IsComponentsV2: 1 << 15,                  // 32768 (0x8000)
});

/**
 * Separator Spacing Sizes
 * @enum {number}
 */
const SeparatorSpacingSize = Object.freeze({
  Small: 1,
  Large: 2,
});

/**
 * Button Styles
 * @enum {number}
 */
const ButtonStyle = Object.freeze({
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
  Link: 5,
  Premium: 6,
});

/**
 * Preset Color Constants (Hex integers)
 * @enum {number}
 */
const Colors = Object.freeze({
  Default: 0x000000,
  White: 0xffffff,
  Aqua: 0x1abc9c,
  Green: 0x57f287,
  Blue: 0x3498db,
  Yellow: 0xfee75c,
  Purple: 0x9b59b6,
  LuminousVividPink: 0xe91e63,
  Fuchsia: 0xeb459e,
  Gold: 0xf1c40f,
  Orange: 0xe67e22,
  Red: 0xed4245,
  Grey: 0x95a5a6,
  Navy: 0x34495e,
  DarkAqua: 0x11806a,
  DarkGreen: 0x1f8b4c,
  DarkBlue: 0x206694,
  DarkPurple: 0x71368a,
  DarkVividPink: 0xad1457,
  DarkGold: 0xc27c0e,
  DarkOrange: 0xa84300,
  DarkRed: 0x992d22,
  DarkGrey: 0x979c9f,
  DarkerGrey: 0x7f8c8d,
  LightGrey: 0xbcc0c0,
  DarkNavy: 0x2c3e50,
  Blurple: 0x5865f2,
  Greyple: 0x99aab5,
  DarkButNotBlack: 0x2b2d31,
  NotQuiteBlack: 0x23272a,
});

// ----------------------------------------------------------------------------
// COLOR RESOLVER UTILITY
// ----------------------------------------------------------------------------

/**
 * Resolves a color input into a 24-bit RGB integer.
 * Accepts:
 * - Hex strings: '#5865F2', '5865F2', '#FFF', '0x5865F2'
 * - Integers: 0x5865F2, 5793266
 * - RGB Tuples/Arrays: [88, 101, 242]
 * - RGB Objects: { r: 88, g: 101, b: 242 }
 * - Named colors: 'Blurple', 'Green', 'Red', 'Gold', etc.
 *
 * @param {string|number|Array<number>|Object} color
 * @returns {number}
 */
function resolveColor(color) {
  if (color === null || color === undefined) {
    return 0;
  }

  if (typeof color === 'number') {
    if (isNaN(color) || color < 0 || color > 0xffffff) {
      throw new RangeError(`Color number out of range (0x000000 - 0xFFFFFF): ${color}`);
    }
    return Math.floor(color);
  }

  if (typeof color === 'string') {
    const trimmed = color.trim();

    // Check named colors (case-insensitive)
    const upperKey = Object.keys(Colors).find(k => k.toLowerCase() === trimmed.toLowerCase());
    if (upperKey) {
      return Colors[upperKey];
    }

    // Hex string parsing
    let hex = trimmed;
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.startsWith('0x') || hex.startsWith('0X')) hex = hex.slice(2);

    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }

    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return parseInt(hex, 16);
    }

    throw new TypeError(`Invalid color string format: "${color}". Expected hex string or preset color name.`);
  }

  if (Array.isArray(color)) {
    if (color.length < 3) {
      throw new TypeError(`Color array must have at least 3 elements [r, g, b]: ${JSON.stringify(color)}`);
    }
    const [r, g, b] = color.map(v => Math.max(0, Math.min(255, Math.floor(v))));
    return (r << 16) + (g << 8) + b;
  }

  if (typeof color === 'object') {
    const r = Math.max(0, Math.min(255, Math.floor(color.r || color.red || 0)));
    const g = Math.max(0, Math.min(255, Math.floor(color.g || color.green || 0)));
    const b = Math.max(0, Math.min(255, Math.floor(color.b || color.blue || 0)));
    return (r << 16) + (g << 8) + b;
  }

  throw new TypeError(`Unsupported color type: ${typeof color}`);
}

/**
 * Chuyển đổi và chuẩn hóa mã màu Accent Color cho Discord Components V2 & Embeds.
 * Hỗ trợ Hex string ('#5865F2', '0x5865F2', '5865F2', '#FFF'), Integer (0x5865F2),
 * RGB string ('rgb(88, 101, 242)'), RGB Array ([88, 101, 242]), RGB Object ({ r, g, b }),
 * và Preset Color Names ('Blurple', 'Green', 'Red', 'Gold', ...).
 * Tự động fallback an toàn về defaultColor khi dữ liệu không hợp lệ.
 *
 * @param {any} color
 * @param {number} [defaultColor=0x5865F2]
 * @returns {number}
 */
function convertAccentColor(color, defaultColor = 0x5865F2) {
  const fallback = typeof defaultColor === 'number' && Number.isFinite(defaultColor) && defaultColor >= 0 && defaultColor <= 0xFFFFFF 
    ? Math.floor(defaultColor) 
    : 0x5865F2;

  if (color === undefined || color === null || typeof color === 'boolean' || typeof color === 'symbol') {
    return fallback;
  }

  // 1. Dạng Number
  if (typeof color === 'number') {
    if (!Number.isFinite(color) || isNaN(color)) return fallback;
    const intVal = Math.floor(color);
    if (intVal >= 0 && intVal <= 0xFFFFFF) {
      return intVal;
    }
    return fallback;
  }

  // 2. Dạng Array: [r, g, b]
  if (Array.isArray(color)) {
    if (color.length >= 3 && color.slice(0, 3).every(v => typeof v === 'number' && Number.isFinite(v))) {
      const r = Math.max(0, Math.min(255, Math.floor(color[0])));
      const g = Math.max(0, Math.min(255, Math.floor(color[1])));
      const b = Math.max(0, Math.min(255, Math.floor(color[2])));
      return (r << 16) | (g << 8) | b;
    }
    return fallback;
  }

  // 3. Dạng Object: { r, g, b }
  if (typeof color === 'object' && color !== null && 'r' in color && 'g' in color && 'b' in color) {
    if (typeof color.r === 'number' && typeof color.g === 'number' && typeof color.b === 'number' &&
        Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
      const r = Math.max(0, Math.min(255, Math.floor(color.r)));
      const g = Math.max(0, Math.min(255, Math.floor(color.g)));
      const b = Math.max(0, Math.min(255, Math.floor(color.b)));
      return (r << 16) | (g << 8) | b;
    }
    return fallback;
  }

  // 4. Dạng String
  if (typeof color === 'string') {
    const raw = color.trim();
    if (!raw) return fallback;

    // Check named preset colors
    const upperKey = Object.keys(Colors).find(k => k.toLowerCase() === raw.toLowerCase());
    if (upperKey) {
      return Colors[upperKey];
    }

    // Check rgb / rgba: 'rgb(88, 101, 242)' hoặc 'rgba(88, 101, 242, 1)'
    const rgbMatch = raw.match(/^rgba?\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
    if (rgbMatch) {
      const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
      const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
      const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
      return (r << 16) | (g << 8) | b;
    }

    let hex = raw;
    if (hex.startsWith('#')) hex = hex.slice(1);
    else if (hex.startsWith('0x') || hex.startsWith('0X')) hex = hex.slice(2);

    // 3-digit shorthand (#FFF -> #FFFFFF)
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      hex = hex.split('').map(c => c + c).join('');
    }

    // 6-digit hex
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      const parsed = parseInt(hex, 16);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) {
        return parsed;
      }
    }
  }

  return fallback;
}

/**
 * Normalizes an emoji input into a Discord API emoji object or undefined
 * @param {string|Object} emoji
 * @returns {Object|undefined}
 */
function normalizeEmoji(emoji) {
  if (!emoji) return undefined;
  if (typeof emoji === 'string') {
    const customMatch = emoji.match(/^<?(a)?:?(\w+):(\d+)>?$/);
    if (customMatch) {
      return {
        animated: Boolean(customMatch[1]),
        name: customMatch[2],
        id: customMatch[3],
      };
    }
    return { name: emoji, id: null };
  }
  if (typeof emoji === 'object') {
    return {
      name: emoji.name || null,
      id: emoji.id || null,
      ...(emoji.animated !== undefined ? { animated: Boolean(emoji.animated) } : {}),
    };
  }
  return undefined;
}

// ----------------------------------------------------------------------------
// BASE COMPONENT BUILDER
// ----------------------------------------------------------------------------

/**
 * Base Component Builder class
 */
class BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    /** @type {number} */
    this.type = data.type;
    /** @type {number|undefined} */
    this.id = data.id !== undefined ? Number(data.id) : undefined;
  }

  /**
   * Sets the 32-bit integer ID for the component
   * @param {number|undefined} id
   * @returns {this}
   */
  setId(id) {
    this.id = id !== undefined ? Number(id) : undefined;
    return this;
  }

  /**
   * Gets the component ID
   * @returns {number|undefined}
   */
  getId() {
    return this.id;
  }

  /**
   * Serializes the component to a raw Discord API JSON object
   * @returns {Object}
   */
  toJSON() {
    const json = { type: this.type };
    if (this.id !== undefined) json.id = this.id;
    return json;
  }
}

// ----------------------------------------------------------------------------
// TEXT DISPLAY BUILDER (Type 10)
// ----------------------------------------------------------------------------

/**
 * TextDisplayBuilder - Renders formatted Markdown text in Components V2
 */
class TextDisplayBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.TextDisplay });
    /** @type {string} */
    this.content = data.content !== undefined ? String(data.content) : '';
    /** @type {boolean|undefined} */
    this.spoiler = data.spoiler !== undefined ? Boolean(data.spoiler) : undefined;
  }

  /**
   * Sets the markdown content
   * @param {string} content
   * @returns {this}
   */
  setContent(content) {
    this.content = content !== undefined && content !== null ? String(content) : '';
    return this;
  }

  /**
   * Sets whether this text display is marked as a spoiler
   * @param {boolean} [spoiler=true]
   * @returns {this}
   */
  setSpoiler(spoiler = true) {
    this.spoiler = Boolean(spoiler);
    return this;
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    json.content = this.content;
    if (this.spoiler !== undefined) {
      json.spoiler = this.spoiler;
    }
    return json;
  }

  /**
   * Creates a TextDisplayBuilder from JSON
   * @param {Object} data
   * @returns {TextDisplayBuilder}
   */
  static from(data) {
    if (data instanceof TextDisplayBuilder) return data;
    return new TextDisplayBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// SEPARATOR BUILDER (Type 14)
// ----------------------------------------------------------------------------

/**
 * SeparatorBuilder - Adds visual spacing and divider line between components
 */
class SeparatorBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.Separator });
    /** @type {boolean|undefined} */
    this.divider = data.divider !== undefined ? Boolean(data.divider) : undefined;
    /** @type {number|undefined} */
    this.spacing = undefined;
    if (data.spacing !== undefined) {
      this.setSpacing(data.spacing);
    }
  }

  /**
   * Sets whether a visible horizontal divider line is shown
   * @param {boolean} [divider=true]
   * @returns {this}
   */
  setDivider(divider = true) {
    this.divider = Boolean(divider);
    return this;
  }

  /**
   * Sets vertical spacing (1 = Small, 2 = Large)
   * @param {number|'small'|'large'|'Small'|'Large'} spacing
   * @returns {this}
   */
  setSpacing(spacing) {
    if (typeof spacing === 'string') {
      const lower = spacing.toLowerCase();
      if (lower === 'small') {
        this.spacing = SeparatorSpacingSize.Small;
      } else if (lower === 'large') {
        this.spacing = SeparatorSpacingSize.Large;
      } else {
        throw new TypeError(`Invalid spacing string: "${spacing}". Expected 'small' or 'large'.`);
      }
    } else if (typeof spacing === 'number') {
      if (spacing !== SeparatorSpacingSize.Small && spacing !== SeparatorSpacingSize.Large) {
        throw new RangeError(`Invalid spacing number: ${spacing}. Expected 1 (Small) or 2 (Large).`);
      }
      this.spacing = spacing;
    } else if (spacing === undefined || spacing === null) {
      this.spacing = undefined;
    } else {
      throw new TypeError(`Unsupported spacing type: ${typeof spacing}`);
    }
    return this;
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    if (this.divider !== undefined) {
      json.divider = this.divider;
    }
    if (this.spacing !== undefined) {
      json.spacing = this.spacing;
    }
    return json;
  }

  /**
   * Creates a SeparatorBuilder from JSON
   * @param {Object} data
   * @returns {SeparatorBuilder}
   */
  static from(data) {
    if (data instanceof SeparatorBuilder) return data;
    return new SeparatorBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// THUMBNAIL BUILDER (Type 11)
// ----------------------------------------------------------------------------

/**
 * ThumbnailBuilder - Section accessory thumbnail image
 */
class ThumbnailBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.Thumbnail });
    /** @type {string} */
    this.url = data.media?.url || data.url || '';
    /** @type {string|undefined} */
    this.proxyUrl = data.media?.proxy_url || data.proxyUrl || undefined;
    /** @type {string|undefined} */
    this.description = data.description !== undefined ? String(data.description) : undefined;
    /** @type {boolean|undefined} */
    this.spoiler = data.spoiler !== undefined ? Boolean(data.spoiler) : undefined;
  }

  /**
   * Sets the image URL
   * @param {string} url
   * @returns {this}
   */
  setURL(url) {
    this.url = String(url || '');
    return this;
  }

  /**
   * Alias for setURL
   * @param {string} url
   * @returns {this}
   */
  setUrl(url) {
    return this.setURL(url);
  }

  /**
   * Sets the proxy URL
   * @param {string|undefined} proxyUrl
   * @returns {this}
   */
  setProxyURL(proxyUrl) {
    this.proxyUrl = proxyUrl ? String(proxyUrl) : undefined;
    return this;
  }

  /**
   * Alias for setProxyURL
   * @param {string|undefined} proxyUrl
   * @returns {this}
   */
  setProxyUrl(proxyUrl) {
    return this.setProxyURL(proxyUrl);
  }

  /**
   * Sets description / alt text
   * @param {string|undefined} description
   * @returns {this}
   */
  setDescription(description) {
    this.description = description !== undefined && description !== null ? String(description) : undefined;
    return this;
  }

  /**
   * Sets whether the thumbnail is a spoiler
   * @param {boolean} [spoiler=true]
   * @returns {this}
   */
  setSpoiler(spoiler = true) {
    this.spoiler = Boolean(spoiler);
    return this;
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    json.media = { url: this.url };
    if (this.proxyUrl) {
      json.media.proxy_url = this.proxyUrl;
    }
    if (this.description !== undefined) {
      json.description = this.description;
    }
    if (this.spoiler !== undefined) {
      json.spoiler = this.spoiler;
    }
    return json;
  }

  /**
   * Creates a ThumbnailBuilder from JSON
   * @param {Object} data
   * @returns {ThumbnailBuilder}
   */
  static from(data) {
    if (data instanceof ThumbnailBuilder) return data;
    return new ThumbnailBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// MEDIA GALLERY ITEM BUILDER & MEDIA GALLERY BUILDER (Type 12)
// ----------------------------------------------------------------------------

/**
 * MediaGalleryItemBuilder - An individual item inside a MediaGallery
 */
class MediaGalleryItemBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    /** @type {string} */
    this.url = data.media?.url || data.url || '';
    /** @type {string|undefined} */
    this.proxyUrl = data.media?.proxy_url || data.proxyUrl || undefined;
    /** @type {string|undefined} */
    this.description = data.description !== undefined ? String(data.description) : undefined;
    /** @type {boolean|undefined} */
    this.spoiler = data.spoiler !== undefined ? Boolean(data.spoiler) : undefined;
  }

  /**
   * Sets the image URL
   * @param {string} url
   * @returns {this}
   */
  setURL(url) {
    this.url = String(url || '');
    return this;
  }

  /**
   * Alias for setURL
   * @param {string} url
   * @returns {this}
   */
  setUrl(url) {
    return this.setURL(url);
  }

  /**
   * Sets the proxy URL
   * @param {string|undefined} proxyUrl
   * @returns {this}
   */
  setProxyURL(proxyUrl) {
    this.proxyUrl = proxyUrl ? String(proxyUrl) : undefined;
    return this;
  }

  /**
   * Alias for setProxyURL
   * @param {string|undefined} proxyUrl
   * @returns {this}
   */
  setProxyUrl(proxyUrl) {
    return this.setProxyURL(proxyUrl);
  }

  /**
   * Sets alt text / description
   * @param {string|undefined} description
   * @returns {this}
   */
  setDescription(description) {
    this.description = description !== undefined && description !== null ? String(description) : undefined;
    return this;
  }

  /**
   * Sets whether the item is a spoiler
   * @param {boolean} [spoiler=true]
   * @returns {this}
   */
  setSpoiler(spoiler = true) {
    this.spoiler = Boolean(spoiler);
    return this;
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = {
      media: {
        url: this.url,
      },
    };
    if (this.proxyUrl) {
      json.media.proxy_url = this.proxyUrl;
    }
    if (this.description !== undefined) {
      json.description = this.description;
    }
    if (this.spoiler !== undefined) {
      json.spoiler = this.spoiler;
    }
    return json;
  }

  /**
   * Creates a MediaGalleryItemBuilder from JSON or URL string
   * @param {Object|string} data
   * @returns {MediaGalleryItemBuilder}
   */
  static from(data) {
    if (data instanceof MediaGalleryItemBuilder) return data;
    if (typeof data === 'string') return new MediaGalleryItemBuilder({ url: data });
    return new MediaGalleryItemBuilder(data);
  }
}

/**
 * MediaGalleryBuilder - Displays 1-10 media attachments/images in a responsive grid
 */
class MediaGalleryBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.MediaGallery });
    /** @type {Array<MediaGalleryItemBuilder>} */
    this.items = [];
    if (Array.isArray(data.items)) {
      this.setItems(data.items);
    }
  }

  /**
   * Adds one or more media gallery items
   * @param {...(MediaGalleryItemBuilder|Object|string)} items
   * @returns {this}
   */
  addItems(...items) {
    const flattened = items.flat(Infinity);
    for (const item of flattened) {
      if (item) {
        this.items.push(MediaGalleryItemBuilder.from(item));
      }
    }
    return this;
  }

  /**
   * Replaces existing items with given list
   * @param {Array<MediaGalleryItemBuilder|Object|string>} items
   * @returns {this}
   */
  setItems(items) {
    this.items = [];
    return this.addItems(items);
  }

  /**
   * Helper to quickly add a single image item
   * @param {string|Object} itemOrUrl
   * @param {string} [description]
   * @param {boolean} [spoiler]
   * @returns {this}
   */
  addImage(itemOrUrl, description, spoiler) {
    if (typeof itemOrUrl === 'string') {
      const item = new MediaGalleryItemBuilder({ url: itemOrUrl, description, spoiler });
      this.items.push(item);
    } else {
      this.addItems(itemOrUrl);
    }
    return this;
  }

  /**
   * Helper to quickly add multiple image URLs
   * @param {Array<string>} urls
   * @returns {this}
   */
  addImages(urls) {
    if (Array.isArray(urls)) {
      for (const url of urls) {
        if (typeof url === 'string') {
          this.addImage(url);
        } else if (url) {
          this.addItems(url);
        }
      }
    }
    return this;
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    json.items = this.items.map(item => (item.toJSON ? item.toJSON() : item));
    return json;
  }

  /**
   * Creates a MediaGalleryBuilder from JSON
   * @param {Object} data
   * @returns {MediaGalleryBuilder}
   */
  static from(data) {
    if (data instanceof MediaGalleryBuilder) return data;
    return new MediaGalleryBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// FILE BUILDER (Type 13)
// ----------------------------------------------------------------------------

/**
 * FileBuilder - Displays an uploaded file attachment using attachment:// URL syntax
 */
class FileBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.File });
    /** @type {string} */
    this.url = data.file?.url || data.url || '';
    /** @type {string|undefined} */
    this.proxyUrl = data.file?.proxy_url || data.proxyUrl || undefined;
    /** @type {boolean|undefined} */
    this.spoiler = data.spoiler !== undefined ? Boolean(data.spoiler) : undefined;
  }

  /**
   * Sets the URL (typically attachment://filename.ext)
   * @param {string} url
   * @returns {this}
   */
  setURL(url) {
    this.url = String(url || '');
    return this;
  }

  /**
   * Alias for setURL
   * @param {string} url
   * @returns {this}
   */
  setUrl(url) {
    return this.setURL(url);
  }

  /**
   * Convenience helper to set URL from attachment filename
   * @param {string} filename
   * @returns {this}
   */
  setAttachment(filename) {
    const name = String(filename || '').replace(/^attachment:\/\//, '');
    this.url = `attachment://${name}`;
    return this;
  }

  /**
   * Sets the proxy URL
   * @param {string|undefined} proxyUrl
   * @returns {this}
   */
  setProxyURL(proxyUrl) {
    this.proxyUrl = proxyUrl ? String(proxyUrl) : undefined;
    return this;
  }

  /**
   * Alias for setProxyURL
   * @param {string|undefined} proxyUrl
   * @returns {this}
   */
  setProxyUrl(proxyUrl) {
    return this.setProxyURL(proxyUrl);
  }

  /**
   * Sets whether the file is a spoiler
   * @param {boolean} [spoiler=true]
   * @returns {this}
   */
  setSpoiler(spoiler = true) {
    this.spoiler = Boolean(spoiler);
    return this;
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    json.file = { url: this.url };
    if (this.proxyUrl) {
      json.file.proxy_url = this.proxyUrl;
    }
    if (this.spoiler !== undefined) {
      json.spoiler = this.spoiler;
    }
    return json;
  }

  /**
   * Creates a FileBuilder from JSON
   * @param {Object} data
   * @returns {FileBuilder}
   */
  static from(data) {
    if (data instanceof FileBuilder) return data;
    return new FileBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// BUTTON BUILDER (Type 2)
// ----------------------------------------------------------------------------

/**
 * ButtonBuilder - Interactive button component
 */
class ButtonBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.Button });
    /** @type {number} */
    this.style = data.style !== undefined ? Number(data.style) : ButtonStyle.Primary;
    /** @type {string|undefined} */
    this.customId = data.custom_id || data.customId || undefined;
    /** @type {string|undefined} */
    this.label = data.label !== undefined ? String(data.label) : undefined;
    /** @type {Object|undefined} */
    this.emoji = normalizeEmoji(data.emoji);
    /** @type {string|undefined} */
    this.url = data.url || undefined;
    /** @type {boolean|undefined} */
    this.disabled = data.disabled !== undefined ? Boolean(data.disabled) : undefined;
    /** @type {string|undefined} */
    this.skuId = data.sku_id || data.skuId || undefined;
  }

  /**
   * Sets button style
   * @param {number} style
   * @returns {this}
   */
  setStyle(style) {
    this.style = Number(style);
    return this;
  }

  /**
   * Sets custom ID
   * @param {string} customId
   * @returns {this}
   */
  setCustomId(customId) {
    this.customId = String(customId || '');
    return this;
  }

  /**
   * Sets text label
   * @param {string} label
   * @returns {this}
   */
  setLabel(label) {
    this.label = String(label || '');
    return this;
  }

  /**
   * Sets emoji
   * @param {string|Object} emoji
   * @returns {this}
   */
  setEmoji(emoji) {
    this.emoji = normalizeEmoji(emoji);
    return this;
  }

  /**
   * Sets link URL (for Link style buttons)
   * @param {string} url
   * @returns {this}
   */
  setURL(url) {
    this.url = String(url || '');
    return this;
  }

  /**
   * Alias for setURL
   * @param {string} url
   * @returns {this}
   */
  setUrl(url) {
    return this.setURL(url);
  }

  /**
   * Sets disabled state
   * @param {boolean} [disabled=true]
   * @returns {this}
   */
  setDisabled(disabled = true) {
    this.disabled = Boolean(disabled);
    return this;
  }

  /**
   * Sets SKU ID (for Premium buttons)
   * @param {string} skuId
   * @returns {this}
   */
  setSkuId(skuId) {
    this.skuId = String(skuId || '');
    return this;
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    json.style = this.style;
    if (this.customId !== undefined) json.custom_id = this.customId;
    if (this.label !== undefined) json.label = this.label;
    if (this.emoji !== undefined) json.emoji = this.emoji;
    if (this.url !== undefined) json.url = this.url;
    if (this.disabled !== undefined) json.disabled = this.disabled;
    if (this.skuId !== undefined) json.sku_id = this.skuId;
    return json;
  }

  /**
   * Creates a ButtonBuilder from JSON
   * @param {Object} data
   * @returns {ButtonBuilder}
   */
  static from(data) {
    if (data instanceof ButtonBuilder) return data;
    return new ButtonBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// STRING SELECT MENU BUILDER (Type 3)
// ----------------------------------------------------------------------------

/**
 * StringSelectMenuOptionBuilder - Option inside a string select menu
 */
class StringSelectMenuOptionBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    /** @type {string} */
    this.label = data.label !== undefined ? String(data.label) : '';
    /** @type {string} */
    this.value = data.value !== undefined ? String(data.value) : '';
    /** @type {string|undefined} */
    this.description = data.description !== undefined ? String(data.description) : undefined;
    /** @type {Object|undefined} */
    this.emoji = normalizeEmoji(data.emoji);
    /** @type {boolean|undefined} */
    this.default = data.default !== undefined ? Boolean(data.default) : undefined;
  }

  setLabel(label) {
    this.label = String(label || '');
    return this;
  }

  setValue(value) {
    this.value = String(value || '');
    return this;
  }

  setDescription(description) {
    this.description = description !== undefined && description !== null ? String(description) : undefined;
    return this;
  }

  setEmoji(emoji) {
    this.emoji = normalizeEmoji(emoji);
    return this;
  }

  setDefault(isDefault = true) {
    this.default = Boolean(isDefault);
    return this;
  }

  toJSON() {
    const json = {
      label: this.label,
      value: this.value,
    };
    if (this.description !== undefined) json.description = this.description;
    if (this.emoji !== undefined) json.emoji = this.emoji;
    if (this.default !== undefined) json.default = this.default;
    return json;
  }

  static from(data) {
    if (data instanceof StringSelectMenuOptionBuilder) return data;
    return new StringSelectMenuOptionBuilder(data);
  }
}

/**
 * StringSelectMenuBuilder - Interactive dropdown select menu
 */
class StringSelectMenuBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.StringSelect });
    /** @type {string|undefined} */
    this.customId = data.custom_id || data.customId || undefined;
    /** @type {string|undefined} */
    this.placeholder = data.placeholder || undefined;
    /** @type {number|undefined} */
    this.minValues = data.min_values !== undefined ? Number(data.min_values) : (data.minValues !== undefined ? Number(data.minValues) : undefined);
    /** @type {number|undefined} */
    this.maxValues = data.max_values !== undefined ? Number(data.max_values) : (data.maxValues !== undefined ? Number(data.maxValues) : undefined);
    /** @type {boolean|undefined} */
    this.disabled = data.disabled !== undefined ? Boolean(data.disabled) : undefined;
    /** @type {Array<StringSelectMenuOptionBuilder>} */
    this.options = [];
    if (Array.isArray(data.options)) {
      this.setOptions(data.options);
    }
  }

  setCustomId(customId) {
    this.customId = String(customId || '');
    return this;
  }

  setPlaceholder(placeholder) {
    this.placeholder = placeholder !== undefined && placeholder !== null ? String(placeholder) : undefined;
    return this;
  }

  setMinValues(minValues) {
    this.minValues = minValues !== undefined ? Number(minValues) : undefined;
    return this;
  }

  setMaxValues(maxValues) {
    this.maxValues = maxValues !== undefined ? Number(maxValues) : undefined;
    return this;
  }

  setDisabled(disabled = true) {
    this.disabled = Boolean(disabled);
    return this;
  }

  addOptions(...options) {
    const flattened = options.flat(Infinity);
    for (const opt of flattened) {
      if (opt) {
        this.options.push(StringSelectMenuOptionBuilder.from(opt));
      }
    }
    return this;
  }

  setOptions(options) {
    this.options = [];
    return this.addOptions(options);
  }

  toJSON() {
    const json = super.toJSON();
    if (this.customId !== undefined) json.custom_id = this.customId;
    if (this.placeholder !== undefined) json.placeholder = this.placeholder;
    if (this.minValues !== undefined) json.min_values = this.minValues;
    if (this.maxValues !== undefined) json.max_values = this.maxValues;
    if (this.disabled !== undefined) json.disabled = this.disabled;
    json.options = this.options.map(opt => (opt.toJSON ? opt.toJSON() : opt));
    return json;
  }

  static from(data) {
    if (data instanceof StringSelectMenuBuilder) return data;
    return new StringSelectMenuBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// SECTION BUILDER (Type 9)
// ----------------------------------------------------------------------------

/**
 * SectionBuilder - Displays 1-3 text components alongside an accessory (Button, Select, Thumbnail)
 */
class SectionBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.Section });
    /** @type {Array<TextDisplayBuilder>} */
    this.components = [];
    /** @type {ButtonBuilder|StringSelectMenuBuilder|ThumbnailBuilder|Object|undefined} */
    this.accessory = undefined;

    if (Array.isArray(data.components)) {
      this.setTextDisplayComponents(data.components);
    }
    if (data.accessory) {
      this.setAccessory(data.accessory);
    }
  }

  /**
   * Adds 1-3 TextDisplay components to the section
   * @param {...(TextDisplayBuilder|Object|string)} components
   * @returns {this}
   */
  addTextDisplayComponents(...components) {
    const flattened = components.flat(Infinity);
    for (const comp of flattened) {
      if (!comp) continue;
      if (typeof comp === 'string') {
        this.components.push(new TextDisplayBuilder({ content: comp }));
      } else if (comp instanceof TextDisplayBuilder) {
        this.components.push(comp);
      } else if (typeof comp === 'object') {
        this.components.push(TextDisplayBuilder.from(comp));
      }
    }
    return this;
  }

  /**
   * Alias for addTextDisplayComponents
   * @param {...(TextDisplayBuilder|Object|string)} components
   * @returns {this}
   */
  addTextDisplays(...components) {
    return this.addTextDisplayComponents(...components);
  }

  /**
   * Alias for addTextDisplayComponents
   * @param {...(TextDisplayBuilder|Object|string)} components
   * @returns {this}
   */
  addComponents(...components) {
    return this.addTextDisplayComponents(...components);
  }

  /**
   * Replaces text displays with the provided array
   * @param {Array<TextDisplayBuilder|Object|string>} components
   * @returns {this}
   */
  setTextDisplayComponents(components) {
    this.components = [];
    return this.addTextDisplayComponents(components);
  }

  /**
   * Alias for setTextDisplayComponents
   * @param {Array<TextDisplayBuilder|Object|string>} components
   * @returns {this}
   */
  setTextDisplays(components) {
    return this.setTextDisplayComponents(components);
  }

  /**
   * Alias for setTextDisplayComponents
   * @param {Array<TextDisplayBuilder|Object|string>} components
   * @returns {this}
   */
  setComponents(components) {
    return this.setTextDisplayComponents(components);
  }

  /**
   * Sets the accessory component (Button, Select Menu, or Thumbnail)
   * @param {ButtonBuilder|StringSelectMenuBuilder|ThumbnailBuilder|Object} accessory
   * @returns {this}
   */
  setAccessory(accessory) {
    if (!accessory) {
      this.accessory = undefined;
      return this;
    }

    if (accessory instanceof BaseComponentBuilder) {
      this.accessory = accessory;
      return this;
    }

    if (typeof accessory === 'object') {
      if (accessory.type === ComponentType.Button) {
        this.accessory = ButtonBuilder.from(accessory);
      } else if (accessory.type === ComponentType.StringSelect) {
        this.accessory = StringSelectMenuBuilder.from(accessory);
      } else if (accessory.type === ComponentType.Thumbnail) {
        this.accessory = ThumbnailBuilder.from(accessory);
      } else {
        this.accessory = accessory;
      }
      return this;
    }

    this.accessory = accessory;
    return this;
  }

  /**
   * Helper to set a button accessory
   * @param {ButtonBuilder|Object} button
   * @returns {this}
   */
  setButtonAccessory(button) {
    return this.setAccessory(ButtonBuilder.from(button));
  }

  /**
   * Helper to set a thumbnail accessory
   * @param {ThumbnailBuilder|Object|string} thumbnail
   * @returns {this}
   */
  setThumbnailAccessory(thumbnail) {
    if (typeof thumbnail === 'string') {
      return this.setAccessory(new ThumbnailBuilder({ url: thumbnail }));
    }
    return this.setAccessory(ThumbnailBuilder.from(thumbnail));
  }

  /**
   * Helper to set a select menu accessory
   * @param {StringSelectMenuBuilder|Object} selectMenu
   * @returns {this}
   */
  setSelectMenuAccessory(selectMenu) {
    return this.setAccessory(StringSelectMenuBuilder.from(selectMenu));
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    json.components = this.components.map(comp => (comp.toJSON ? comp.toJSON() : comp));
    if (this.accessory !== undefined) {
      json.accessory = this.accessory.toJSON ? this.accessory.toJSON() : this.accessory;
    }
    return json;
  }

  /**
   * Creates a SectionBuilder from JSON
   * @param {Object} data
   * @returns {SectionBuilder}
   */
  static from(data) {
    if (data instanceof SectionBuilder) return data;
    return new SectionBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// ACTION ROW BUILDER (Type 1)
// ----------------------------------------------------------------------------

/**
 * ActionRowBuilder - Standard container for buttons and select menus
 */
class ActionRowBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.ActionRow });
    /** @type {Array<BaseComponentBuilder|Object>} */
    this.components = [];
    if (Array.isArray(data.components)) {
      this.setComponents(data.components);
    }
  }

  /**
   * Adds components to the action row
   * @param {...(BaseComponentBuilder|Object)} components
   * @returns {this}
   */
  addComponents(...components) {
    const flattened = components.flat(Infinity);
    for (const comp of flattened) {
      if (!comp) continue;
      if (comp instanceof BaseComponentBuilder) {
        this.components.push(comp);
      } else if (typeof comp === 'object') {
        if (comp.type === ComponentType.Button) {
          this.components.push(ButtonBuilder.from(comp));
        } else if (comp.type === ComponentType.StringSelect) {
          this.components.push(StringSelectMenuBuilder.from(comp));
        } else {
          this.components.push(comp);
        }
      }
    }
    return this;
  }

  /**
   * Replaces existing components
   * @param {Array<BaseComponentBuilder|Object>} components
   * @returns {this}
   */
  setComponents(components) {
    this.components = [];
    return this.addComponents(components);
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    json.components = this.components.map(comp => (comp.toJSON ? comp.toJSON() : comp));
    return json;
  }

  /**
   * Creates an ActionRowBuilder from JSON
   * @param {Object} data
   * @returns {ActionRowBuilder}
   */
  static from(data) {
    if (data instanceof ActionRowBuilder) return data;
    return new ActionRowBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// CONTAINER BUILDER (Type 17)
// ----------------------------------------------------------------------------

/**
 * ContainerBuilder - Top-level layout component grouping sections, text displays,
 * media galleries, separators, files, and action rows with accent styling & spoiler tags.
 */
class ContainerBuilder extends BaseComponentBuilder {
  /**
   * @param {Object} [data={}]
   */
  constructor(data = {}) {
    super({ ...data, type: ComponentType.Container });
    /** @type {number|undefined} */
    this.accentColor = undefined;
    if (data.accent_color !== undefined || data.accentColor !== undefined) {
      this.setAccentColor(data.accent_color !== undefined ? data.accent_color : data.accentColor);
    }
    /** @type {boolean|undefined} */
    this.spoiler = data.spoiler !== undefined ? Boolean(data.spoiler) : undefined;
    /** @type {Array<BaseComponentBuilder|Object>} */
    this.components = [];

    if (Array.isArray(data.components)) {
      this.setComponents(data.components);
    }
  }

  /**
   * Sets accent color (border/side color of the container)
   * Accepts hex string ('#5865F2'), int (0x5865F2), RGB array, or named preset color.
   * @param {string|number|Array<number>|Object} color
   * @returns {this}
   */
  setAccentColor(color) {
    if (color === null || color === undefined) {
      this.accentColor = undefined;
      return this;
    }
    this.accentColor = resolveColor(color);
    return this;
  }

  /**
   * Sets whether the entire container is blurred behind a spoiler tag
   * @param {boolean} [spoiler=true]
   * @returns {this}
   */
  setSpoiler(spoiler = true) {
    this.spoiler = Boolean(spoiler);
    return this;
  }

  /**
   * Adds child components to the container (Sections, TextDisplays, MediaGalleries, Separators, ActionRows, Files)
   * @param {...(BaseComponentBuilder|Object)} components
   * @returns {this}
   */
  addComponents(...components) {
    const flattened = components.flat(Infinity);
    for (const comp of flattened) {
      if (!comp) continue;
      if (comp instanceof BaseComponentBuilder) {
        this.components.push(comp);
      } else if (typeof comp === 'object') {
        // Auto-convert raw JSON to appropriate builder if possible
        this.components.push(fromJSON(comp));
      }
    }
    return this;
  }

  /**
   * Adds Section components to the container
   * @param {...(SectionBuilder|Object)} sections
   * @returns {this}
   */
  addSectionComponents(...sections) {
    return this.addComponents(...sections);
  }

  /**
   * Adds TextDisplay components to the container
   * @param {...(TextDisplayBuilder|Object|string)} textDisplays
   * @returns {this}
   */
  addTextDisplayComponents(...textDisplays) {
    const flattened = textDisplays.flat(Infinity);
    for (const item of flattened) {
      if (!item) continue;
      if (typeof item === 'string') {
        this.components.push(new TextDisplayBuilder({ content: item }));
      } else if (item instanceof TextDisplayBuilder) {
        this.components.push(item);
      } else if (typeof item === 'object') {
        this.components.push(TextDisplayBuilder.from(item));
      }
    }
    return this;
  }

  /**
   * Adds Separator components to the container
   * @param {...(SeparatorBuilder|Object)} separators
   * @returns {this}
   */
  addSeparatorComponents(...separators) {
    return this.addComponents(...separators);
  }

  /**
   * Adds ActionRow components to the container
   * @param {...(ActionRowBuilder|Object)} actionRows
   * @returns {this}
   */
  addActionRowComponents(...actionRows) {
    return this.addComponents(...actionRows);
  }

  /**
   * Adds MediaGallery components to the container
   * @param {...(MediaGalleryBuilder|Object)} galleries
   * @returns {this}
   */
  addMediaGalleryComponents(...galleries) {
    return this.addComponents(...galleries);
  }

  /**
   * Adds File components to the container
   * @param {...(FileBuilder|Object)} files
   * @returns {this}
   */
  addFileComponents(...files) {
    return this.addComponents(...files);
  }

  /**
   * Replaces existing child components
   * @param {Array<BaseComponentBuilder|Object>} components
   * @returns {this}
   */
  setComponents(components) {
    this.components = [];
    return this.addComponents(components);
  }

  /**
   * Serializes to Discord API format
   * @returns {Object}
   */
  toJSON() {
    const json = super.toJSON();
    if (this.accentColor !== undefined) {
      json.accent_color = this.accentColor;
    }
    if (this.spoiler !== undefined) {
      json.spoiler = this.spoiler;
    }
    json.components = this.components.map(comp => (comp.toJSON ? comp.toJSON() : comp));
    return json;
  }

  /**
   * Creates a ContainerBuilder from JSON
   * @param {Object} data
   * @returns {ContainerBuilder}
   */
  static from(data) {
    if (data instanceof ContainerBuilder) return data;
    return new ContainerBuilder(data);
  }
}

// ----------------------------------------------------------------------------
// DESERIALIZER & FACTORY FUNCTIONS
// ----------------------------------------------------------------------------

/**
 * Converts a raw Discord Component JSON object into its corresponding Builder class instance.
 * @param {Object} data
 * @returns {BaseComponentBuilder|Object}
 */
function fromJSON(data) {
  if (!data || typeof data !== 'object') return data;
  if (data instanceof BaseComponentBuilder) return data;

  switch (data.type) {
    case ComponentType.ActionRow:
      return ActionRowBuilder.from(data);
    case ComponentType.Button:
      return ButtonBuilder.from(data);
    case ComponentType.StringSelect:
      return StringSelectMenuBuilder.from(data);
    case ComponentType.Section:
      return SectionBuilder.from(data);
    case ComponentType.TextDisplay:
      return TextDisplayBuilder.from(data);
    case ComponentType.Thumbnail:
      return ThumbnailBuilder.from(data);
    case ComponentType.MediaGallery:
      return MediaGalleryBuilder.from(data);
    case ComponentType.File:
      return FileBuilder.from(data);
    case ComponentType.Separator:
      return SeparatorBuilder.from(data);
    case ComponentType.Container:
      return ContainerBuilder.from(data);
    default:
      return data;
  }
}

/**
 * Helper to build a full Discord message / interaction payload with Components V2.
 * Automatically ensures the MessageFlags.IsComponentsV2 flag is attached.
 *
 * @param {Object} options
 * @param {Array<BaseComponentBuilder|Object>} options.components - ContainerBuilders or ComponentBuilders
 * @param {number} [options.flags=0] - Additional message flags (e.g. MessageFlags.Ephemeral)
 * @param {string} [options.content] - Optional text content
 * @param {Array<Object>} [options.files] - Optional file attachments
 * @returns {Object} Ready-to-send Discord message payload
 */
function createComponentPayload(options = {}) {
  const flags = (Number(options.flags) || 0) | MessageFlags.IsComponentsV2;
  const rawComponents = Array.isArray(options.components) ? options.components.flat(Infinity) : [];

  const components = rawComponents.map(comp => {
    if (comp && typeof comp.toJSON === 'function') {
      return comp.toJSON();
    }
    return comp;
  });

  const payload = {
    ...options,
    flags,
    components,
  };

  return payload;
}

/**
 * Tạo Payload gửi tin nhắn Dual-Mode (tương thích cả Discord Components V2 và Legacy Embeds V1).
 *
 * @param {Object} options
 * @param {string} [options.title]
 * @param {string} [options.description]
 * @param {string|number|Array<number>|Object} [options.color=0x5865F2]
 * @param {Array<Object>} [options.fields=[]]
 * @param {string} [options.imageUrl]
 * @param {string} [options.thumbnailUrl]
 * @param {string|Object} [options.footer]
 * @param {Array<ButtonBuilder|Object>} [options.buttons=[]]
 * @param {StringSelectMenuBuilder|Object} [options.selectMenu]
 * @param {boolean} [options.spoiler=false]
 * @param {boolean} [options.preferV2=false]
 * @param {number} [options.flags=0]
 * @returns {Object}
 */
function createDualModePayload(options = {}) {
  const {
    title,
    description,
    color = 0x5865F2,
    fields = [],
    imageUrl,
    thumbnailUrl,
    footer,
    buttons = [],
    selectMenu = null,
    spoiler = false,
    preferV2 = false,
    flags = 0
  } = options;

  const accentColorInt = convertAccentColor(color);

  if (preferV2) {
    const container = new ContainerBuilder().setAccentColor(accentColorInt);

    if (spoiler) {
      container.setSpoiler(true);
    }

    const headerParts = [];
    if (title && typeof title === 'string' && title.trim()) {
      headerParts.push(`# ${title.trim()}`);
    }
    if (description && typeof description === 'string' && description.trim()) {
      headerParts.push(description.trim());
    }
    const headerContent = headerParts.join('\n');

    if (thumbnailUrl && typeof thumbnailUrl === 'string' && thumbnailUrl.trim()) {
      const section = new SectionBuilder();
      if (headerContent) {
        section.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerContent.slice(0, 4000)));
      } else {
        section.addTextDisplayComponents(new TextDisplayBuilder().setContent('**LS STUDIO**'));
      }
      section.setThumbnailAccessory(
        new ThumbnailBuilder()
          .setURL(thumbnailUrl.trim())
          .setDescription((title || 'Thumbnail').slice(0, 256))
          .setSpoiler(Boolean(spoiler))
      );
      container.addComponents(section);
    } else if (headerContent) {
      container.addComponents(new TextDisplayBuilder().setContent(headerContent.slice(0, 4000)));
    }

    if (Array.isArray(fields) && fields.length > 0) {
      const validFields = fields.filter(f => f && (f.name || f.value));
      if (validFields.length > 0) {
        container.addComponents(
          new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );
        for (const field of validFields) {
          const fieldName = String(field.name || '').trim();
          const fieldValue = String(field.value || '').trim();
          const content = fieldName && fieldValue 
            ? `### ${fieldName}\n${fieldValue}`
            : (fieldName ? `### ${fieldName}` : fieldValue);
          if (content) {
            container.addComponents(
              new TextDisplayBuilder().setContent(content.slice(0, 4000))
            );
          }
        }
      }
    }

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
      container.addComponents(
        new MediaGalleryBuilder().addImage(
          imageUrl.trim(),
          (title || 'Image').slice(0, 256),
          Boolean(spoiler)
        )
      );
    }

    if (footer) {
      const footerText = typeof footer === 'string' ? footer.trim() : (footer.text ? String(footer.text).trim() : '');
      if (footerText) {
        container.addComponents(
          new TextDisplayBuilder().setContent(`-# ${footerText.slice(0, 1000)}`)
        );
      }
    }

    if (Array.isArray(buttons) && buttons.length > 0) {
      const buttonRow = new ActionRowBuilder().addComponents(...buttons.slice(0, 5));
      container.addComponents(buttonRow);
    }

    if (selectMenu) {
      const menuRow = new ActionRowBuilder().addComponents(selectMenu);
      container.addComponents(menuRow);
    }

    return {
      components: [container],
      flags: (flags || 0) | MessageFlags.IsComponentsV2
    };
  } else {
    // Legacy V1 Fallback
    const embed = {
      color: accentColorInt,
      title: title ? String(title).slice(0, 256) : undefined,
      description: description ? String(description).slice(0, 4096) : undefined,
      fields: Array.isArray(fields) && fields.length > 0 ? fields.map(f => ({
        name: String(f.name || '\u200b').slice(0, 256),
        value: String(f.value || '\u200b').slice(0, 1024),
        inline: Boolean(f.inline)
      })).slice(0, 25) : undefined,
      image: imageUrl ? { url: imageUrl } : undefined,
      thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
      footer: footer ? { text: String(typeof footer === 'string' ? footer : footer.text || '').slice(0, 2048) } : undefined,
      timestamp: new Date().toISOString()
    };

    const actionRows = [];
    if (Array.isArray(buttons) && buttons.length > 0) {
      actionRows.push(new ActionRowBuilder().addComponents(...buttons.slice(0, 5)));
    }
    if (selectMenu) {
      actionRows.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    return {
      embeds: [embed],
      components: actionRows,
      flags: flags || 0
    };
  }
}

/**
 * Chuyển đổi payload Legacy V1 (Embeds) sang Components V2 (Container) tự động.
 * @param {Object} legacyPayload
 * @returns {Object}
 */
function convertLegacyToComponentsV2(legacyPayload = {}) {
  if (!legacyPayload) return { components: [], flags: MessageFlags.IsComponentsV2 };
  
  const embed = Array.isArray(legacyPayload.embeds) && legacyPayload.embeds.length > 0 
    ? legacyPayload.embeds[0] 
    : (legacyPayload.embed ? legacyPayload.embed : null);
  
  const embedData = embed && typeof embed.toJSON === 'function' ? embed.toJSON() : (embed?.data || embed || {});
  
  const buttons = [];
  let selectMenu = null;
  if (Array.isArray(legacyPayload.components)) {
    for (const row of legacyPayload.components) {
      const rowComponents = row.components || (typeof row.toJSON === 'function' ? row.toJSON().components : []);
      for (const comp of rowComponents) {
        const type = comp.type || comp.data?.type;
        if (type === ComponentType.Button || type === 2) {
          buttons.push(comp);
        } else if (type === ComponentType.StringSelect || type === 3) {
          selectMenu = comp;
        }
      }
    }
  }

  return createDualModePayload({
    preferV2: true,
    color: embedData.color || 0x5865F2,
    title: embedData.title,
    description: embedData.description,
    fields: embedData.fields || [],
    thumbnailUrl: embedData.thumbnail?.url,
    imageUrl: embedData.image?.url,
    footer: embedData.footer?.text,
    buttons,
    selectMenu,
    flags: legacyPayload.flags || 0
  });
}

/**
 * Chuyển đổi payload Components V2 sang Legacy V1 (Embeds) khi cần fallback về client cũ.
 * @param {Object} v2Payload
 * @returns {Object}
 */
function convertComponentsV2ToLegacy(v2Payload = {}) {
  if (!v2Payload) return { embeds: [], components: [], flags: 0 };
  
  const rawContainer = Array.isArray(v2Payload.components) && v2Payload.components.length > 0
    ? v2Payload.components[0]
    : null;
  
  const containerData = rawContainer && typeof rawContainer.toJSON === 'function' 
    ? rawContainer.toJSON() 
    : (rawContainer?.data || rawContainer || {});
  
  const color = containerData.accent_color !== undefined ? convertAccentColor(containerData.accent_color) : 0x5865F2;
  const actionRows = [];
  const fields = [];
  const textContents = [];
  let title;
  let imageUrl;
  let thumbnailUrl;
  let footerText;

  if (Array.isArray(containerData.components)) {
    for (const child of containerData.components) {
      if (child.type === ComponentType.TextDisplay || child.type === 10) {
        if (child.content) {
          if (child.content.startsWith('### ')) {
            const lines = child.content.slice(4).split('\n');
            const name = lines[0] || 'Field';
            const val = lines.slice(1).join('\n') || '\u200b';
            fields.push({ name, value: val, inline: false });
          } else if (child.content.startsWith('-# ')) {
            footerText = child.content.slice(3);
          } else if (child.content.startsWith('# ')) {
            const lines = child.content.slice(2).split('\n');
            title = lines[0];
            if (lines.length > 1) {
              textContents.push(lines.slice(1).join('\n'));
            }
          } else {
            textContents.push(child.content);
          }
        }
      } else if (child.type === ComponentType.Section || child.type === 9) {
        if (Array.isArray(child.components)) {
          for (const sub of child.components) {
            if (sub.content) {
              if (sub.content.startsWith('# ')) {
                const lines = sub.content.slice(2).split('\n');
                title = lines[0];
                if (lines.length > 1) {
                  textContents.push(lines.slice(1).join('\n'));
                }
              } else {
                textContents.push(sub.content);
              }
            }
          }
        }
        if (child.accessory) {
          if (child.accessory.type === ComponentType.Thumbnail || child.accessory.type === 11) {
            if (child.accessory.media?.url) {
              thumbnailUrl = child.accessory.media.url;
            }
          } else if (child.accessory.type === ComponentType.Button || child.accessory.type === 2) {
            actionRows.push(new ActionRowBuilder().addComponents(child.accessory));
          }
        }
      } else if (child.type === ComponentType.MediaGallery || child.type === 12) {
        if (Array.isArray(child.items) && child.items[0]?.media?.url) {
          imageUrl = child.items[0].media.url;
        }
      } else if (child.type === ComponentType.ActionRow || child.type === 1) {
        if (Array.isArray(child.components) && child.components.length > 0) {
          actionRows.push(child);
        }
      }
    }
  }

  const embed = {
    color,
    title: title ? title.slice(0, 256) : undefined,
    description: textContents.length > 0 ? textContents.join('\n\n').slice(0, 4096) : undefined,
    fields: fields.length > 0 ? fields.slice(0, 25) : undefined,
    image: imageUrl ? { url: imageUrl } : undefined,
    thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
    footer: footerText ? { text: footerText.slice(0, 2048) } : undefined,
    timestamp: new Date().toISOString()
  };

  const cleanedFlags = (v2Payload.flags || 0) & ~MessageFlags.IsComponentsV2;

  return {
    embeds: [embed],
    components: actionRows,
    flags: cleanedFlags
  };
}

/**
 * Kiểm tra xem payload có sử dụng Components V2 hay không.
 * @param {Object} payload
 * @returns {boolean}
 */
function isComponentsV2Payload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if ((payload.flags & MessageFlags.IsComponentsV2) === MessageFlags.IsComponentsV2) {
    return true;
  }
  if (Array.isArray(payload.components) && payload.components.length > 0) {
    const first = payload.components[0];
    const type = first?.data?.type || first?.type;
    if (type === ComponentType.Container || type === 17) {
      return true;
    }
  }
  return false;
}

// ----------------------------------------------------------------------------
// EXPORTS (CommonJS)
// ----------------------------------------------------------------------------

module.exports = {
  // Enums & Constants
  ComponentType,
  MessageFlags,
  SeparatorSpacingSize,
  ButtonStyle,
  Colors,

  // Builder Classes
  BaseComponentBuilder,
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  FileBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,

  // Utilities & Helpers
  resolveColor,
  convertAccentColor,
  normalizeEmoji,
  fromJSON,
  createComponentPayload,
  createDualModePayload,
  convertLegacyToComponentsV2,
  convertComponentsV2ToLegacy,
  isComponentsV2Payload,
};
