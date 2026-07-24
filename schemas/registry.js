import { validateSchema } from '/core/validator.js';
import { AnnouncementSchema } from '/schemas/announcement.js';
import { BlogSchema } from '/schemas/blog.js';
import { BookSchema } from '/schemas/book.js';
import { EducationSchema } from '/schemas/education.js';
import { HowToSchema } from '/schemas/howto.js';
import { PodcastSchema } from '/schemas/podcast.js';
import { PortfolioSchema } from '/schemas/portfolio.js';
import { SponsorSchema } from '/schemas/sponsor.js';
import { EventSchema } from '/schemas/event.js';

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