import { validateSchema } from '../core/validator.js';
import { AnnouncementSchema } from './announcement.js';
import { BlogSchema } from './blog.js';
import { BookSchema } from './book.js';
import { EducationSchema } from './education.js';
import { HowToSchema } from './howto.js';
import { PodcastSchema } from './podcast.js';
import { PortfolioSchema } from './portfolio.js';
import { SponsorSchema } from './sponsor.js';
import { EventSchema } from './event.js';
import { ProductSchema } from './product.js';

class SchemaRegistry {
  #schemas = new Map();

  constructor() {
    this.register('announcement', AnnouncementSchema);
    this.register('blog', BlogSchema);
    this.register('book', BookSchema);
    this.register('education', EducationSchema);
    this.register('howto', HowToSchema);
    this.register('podcast', PodcastSchema);
    this.register('portfolio', PortfolioSchema);
    this.register('sponsor', SponsorSchema);
    this.register('event', EventSchema);
    this.register('product', ProductSchema);
  }

  register(contentType, schemaDefinition) {
    if (this.#schemas.has(contentType)) {
      console.warn(`[SchemaRegistry]: Overwriting schema for "${contentType}"`);
    }
    this.#schemas.set(contentType, schemaDefinition);
  }

  validate(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('[SchemaRegistry]: Cannot validate null or non-object content data.');
    }

    const contentType = data.type;
    if (!contentType) {
      throw new Error('[SchemaRegistry]: Content JSON is missing required "type" field.');
    }

    const schema = this.#schemas.get(contentType);
    if (!schema) {
      throw new Error(`[SchemaRegistry]: No schema registered for content type "${contentType}".`);
    }

    return validateSchema(schema, data, `ContentType[${contentType}]`);
  }
}

export const schemaRegistry = new SchemaRegistry();