import {
  FaArrowRight,
  FaBoxOpen,
  FaCheck,
  FaChevronDown,
  FaGlobeAfrica,
  FaHeadset,
  FaMapMarkerAlt,
  FaShieldAlt,
  FaShippingFast,
  FaStore,
} from "react-icons/fa";
import Link from "next/link";
import LandingHeader from "@/components/LandingHeader";
import BookDeliveryDialog from "@/components/BookDeliveryDialog";

const services = [
  {
    icon: FaBoxOpen,
    title: "Parcel delivery",
    description:
      "From important documents to thoughtful gifts, we get your parcels where they need to be.",
  },
  {
    icon: FaShippingFast,
    title: "Express courier",
    description:
      "When timing matters, book a faster collection and delivery with our courier team.",
    featured: true,
  },
  {
    icon: FaStore,
    title: "Business delivery",
    description:
      "Dependable fulfilment for growing businesses, online shops, and busy teams.",
  },
  {
    icon: FaGlobeAfrica,
    title: "Long-distance shipping",
    description:
      "Send beyond your neighbourhood with a team that keeps every handoff in view.",
  },
  {
    icon: FaMapMarkerAlt,
    title: "Doorstep pickup",
    description:
      "Skip the extra trip. Arrange a convenient pickup from home, work, or your store.",
  },
  {
    icon: FaShieldAlt,
    title: "Careful handling",
    description:
      "Thoughtful handling and clear updates help every delivery feel a little easier.",
  },
];

const gallery = [
  {
    image:
      "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=85",
    label: "Delivery truck travelling along a road",
    className: "gallery-tall",
  },
  {
    image:
      "https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?auto=format&fit=crop&w=800&q=85",
    label: "Packages ready for delivery",
    className: "",
  },
  {
    image:
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=85",
    label: "Organised parcel warehouse",
    className: "",
  },
  {
    image:
      "https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=85",
    label: "Delivery van on the road",
    className: "",
  },
  {
    image:
      "https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&w=800&q=85",
    label: "Courier handing over a parcel",
    className: "gallery-wide",
  },
];

const benefits = [
  {
    icon: FaShippingFast,
    title: "Made for real life",
    description:
      "Flexible delivery options that fit the way people and businesses actually move.",
  },
  {
    icon: FaMapMarkerAlt,
    title: "Know what’s happening",
    description:
      "Helpful updates make it easier to follow a delivery from pickup to drop-off.",
  },
  {
    icon: FaHeadset,
    title: "People who can help",
    description:
      "Our team is here to make the delivery process feel straightforward and personal.",
  },
];

const faqs = [
  {
    question: "How do I arrange a delivery?",
    answer:
      "Get in touch with our team using the WhatsApp button on this page. We’ll help you choose the right service and arrange the next steps.",
  },
  {
    question: "Can I send a parcel from my home or office?",
    answer:
      "Yes. Ask our team about arranging a pickup from your preferred location.",
  },
  {
    question: "How can I check on my delivery?",
    answer:
      "Our team can provide updates and help you follow your parcel while it is on its way.",
  },
  {
    question: "Do you work with businesses?",
    answer:
      "We support businesses with delivery needs, from individual orders to ongoing dispatch. Contact us to discuss what works for your team.",
  },
];

function Brand({ footer = false }) {
  return (
    <Link
      href="/"
      className={`brand${footer ? " brand-footer" : ""}`}
      aria-label="AH Delivery home"
    >
      <span className="brand-mark">
        <FaShippingFast aria-hidden="true" />
      </span>
      <span>
        <strong>AH</strong> Delivery
      </span>
    </Link>
  );
}

function SectionHeading({ eyebrow, title, description, centered = false }) {
  return (
    <div className={`section-heading${centered ? " section-heading-center" : ""}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <LandingHeader />

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="eyebrow hero-eyebrow">
              <span className="eyebrow-dot" />
              DELIVERY THAT MOVES WITH YOU
            </span>
            <h1>
              Good things are
              <br />
              <span>on their way.</span>
            </h1>
            <p className="hero-description">
              From a little something across town to the next big step for your
              business, we make every delivery feel simple.
            </p>
            <div className="hero-actions">
              <div id="booking">
                <BookDeliveryDialog />
              </div>
              <a className="text-link" href="#about">
                How we work <FaArrowRight aria-hidden="true" />
              </a>
            </div>
            <div className="hero-assurance">
              <span className="assurance-icon">
                <FaCheck aria-hidden="true" />
              </span>
              <span>Thoughtful service, from pickup to delivery</span>
            </div>
          </div>

          <div className="hero-visual">
            <div
              className="hero-photo"
              role="img"
              aria-label="A delivery truck travelling along a road"
            />
            <div className="hero-image-shape" />
            <div className="delivery-note">
              <span className="note-icon">
                <FaBoxOpen aria-hidden="true" />
              </span>
              <span>
                <strong>Ready when you are</strong>
                <small>We’ll take it from here</small>
              </span>
              <span className="note-check">
                <FaCheck aria-hidden="true" />
              </span>
            </div>
            <div className="route-note">
              <span className="route-icon">
                <FaMapMarkerAlt aria-hidden="true" />
              </span>
              <span>
                <strong>Door to door</strong>
                <small>Right where it belongs</small>
              </span>
            </div>
            <span className="hero-spark spark-one">✳</span>
            <span className="hero-spark spark-two">✳</span>
          </div>
        </div>
      </section>

      <section className="service-section page-section" id="services">
        <div className="section-container">
          <SectionHeading
            eyebrow="WHAT WE DO"
            title="A better way to get there."
            description="Good service starts with the right delivery. Find the one that fits yours."
            centered
          />
          <div className="service-grid">
            {services.map(({ icon: Icon, title, description, featured }) => (
              <article
                className={`service-card${featured ? " service-card-featured" : ""}`}
                key={title}
              >
                <span className="service-icon">
                  <Icon aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{description}</p>
                <a
                  className="service-link"
                  href="#contact"
                  aria-label={`Learn more about ${title}`}
                >
                  Learn more <FaArrowRight aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="gallery-section page-section">
        <div className="section-container">
          <SectionHeading
            eyebrow="A CLOSER LOOK"
            title="Every parcel has a story."
            description="A little care goes a long way. Here’s a glimpse of the people and moments behind every delivery."
            centered
          />
          <div className="gallery-grid">
            {gallery.map(({ image, label, className }) => (
              <div
                className={`gallery-image ${className}`}
                key={label}
                role="img"
                aria-label={label}
                style={{ backgroundImage: `url("${image}")` }}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="about-section page-section" id="about">
        <div className="section-container about-layout">
          <div className="about-copy">
            <SectionHeading
              eyebrow="THE AH DIFFERENCE"
              title="Here for the handoff, and everything around it."
              description="Great delivery is about more than getting from A to B. It’s about trust, clear communication, and knowing someone’s taking care of it."
            />
            <a className="button" href="#contact">
              Get to know us <FaArrowRight aria-hidden="true" />
            </a>
          </div>
          <div className="benefit-list">
            {benefits.map(({ icon: Icon, title, description }, index) => (
              <article className="benefit-item" key={title}>
                <span className="benefit-number">0{index + 1}</span>
                <span className="benefit-icon">
                  <Icon aria-hidden="true" />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="faq-section page-section" id="faq">
        <div className="section-container faq-layout">
          <SectionHeading
            eyebrow="GOOD TO KNOW"
            title="A few things you might be wondering."
            description="Can’t find what you’re looking for? Our team is happy to help."
          />
          <div className="faq-list">
            {faqs.map(({ question, answer }, index) => (
              <details className="faq-item" key={question} open={index === 0}>
                <summary>
                  <span>{question}</span>
                  <FaChevronDown aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="contact-inner">
          <div>
            <span className="eyebrow">YOUR NEXT DELIVERY STARTS HERE</span>
            <h2>Let’s get it moving.</h2>
            <p>Tell us what you need delivered. We’ll help with the rest.</p>
          </div>
          <a className="button button-light" href="#contact">
            Talk to our team <FaArrowRight aria-hidden="true" />
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <Brand footer />
          <p>Moving what matters, with a little more care.</p>
          <div className="footer-links">
            <a href="#services">Services</a>
            <a href="#about">About</a>
            <a href="#faq">FAQs</a>
            <a href="#contact">Contact</a>
          </div>
          <span className="copyright">
            © AH Delivery. All rights reserved.
          </span>
        </div>
      </footer>
    </main>
  );
}
