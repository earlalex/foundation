import { validateSchema, Type } from '../core/validator.js';
import { AccessSchema, PreviewSchema } from './common.js';
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
import { PageSchema } from './page.js';
import { VaSchema } from './va.js';
import { EmailTemplateSchema } from './email_template.js';
import { ZapScanSchema } from './zap_scan.js';
import { MarketingSegmentSchema } from './marketing_segment.js';
import { MarketingJourneySchema } from './marketing_journey.js';

class SchemaRegistry {
  #schemas = new Map();

  constructor() {
    this.register('announcement', AnnouncementSchema);
    this.register('custom_modal', {
      type: Type.string,
      id: Type.string,
      title: Type.string,
      modalType: Type.string, // 'newsletter', 'product', 'announcement', 'discount'
      triggerType: Type.string, // 'immediate', 'delay', 'scroll', 'exit'
      triggerValue: Type.optional(Type.any),
      targetPages: Type.string, // 'all', 'home', 'shop'
      contentHtml: Type.optional(Type.string),
      imageUrl: Type.optional(Type.string),
      ctaText: Type.optional(Type.string),
      ctaUrl: Type.optional(Type.string),
      discountCode: Type.optional(Type.string),
      isActive: Type.optional(Type.boolean),
      description: Type.optional(Type.string),
      longFormText: Type.optional(Type.array),
      author: Type.optional(Type.string),
      date: Type.optional(Type.string),
      access: Type.optional(AccessSchema)
    });
    this.register('blog', BlogSchema);
    this.register('review', {
      type: Type.string,
      id: Type.string,
      title: Type.string,
      author: Type.string,
      description: Type.string,
      longFormText: Type.array,
      rating: Type.number,
      date: Type.string,
      preview: Type.optional(PreviewSchema),
      access: Type.optional(AccessSchema)
    });
    this.register('book', BookSchema);
    this.register('education', EducationSchema);
    this.register('howto', HowToSchema);
    this.register('podcast', PodcastSchema);
    this.register('portfolio', PortfolioSchema);
    this.register('sponsor', SponsorSchema);
    this.register('event', EventSchema);
    this.register('product', ProductSchema);
    this.register('page', PageSchema);
    this.register('va_candidate', VaSchema);
    this.register('va_hired', VaSchema);
    this.register('email_templates', EmailTemplateSchema);
    this.register('security_audit', {
      id: Type.string,
      type: Type.literal('security_audit'),
      timestamp: Type.string,
      overallRating: Type.string,
      totalAssets: Type.number,
      maliciousAssets: Type.number,
      reportSummary: Type.string
    });
    this.register('zap_scans', ZapScanSchema);
    this.register('marketing_segments', MarketingSegmentSchema);
    this.register('marketing_journeys', MarketingJourneySchema);
    this.register('finances_expenses', {
      type: Type.literal('finances_expenses'),
      id: Type.string,
      category: Type.string,
      vendor: Type.string,
      amount: Type.number,
      date: Type.string,
      isRecurring: Type.optional(Type.boolean),
      notes: Type.optional(Type.string),
      title: Type.optional(Type.string)
    });
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
