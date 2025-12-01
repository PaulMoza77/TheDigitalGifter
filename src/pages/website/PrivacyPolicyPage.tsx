import React from "react";
import {
  BarChart3,
  Target,
  Users,
  Shield,
  Cookie,
  Scale,
  Globe,
  Baby,
  FileText,
  Clock,
  Lock,
  Mail,
  HelpCircle,
} from "lucide-react";

export function PrivacyPolicyPage() {
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      "📊": BarChart3,
      "🎯": Target,
      "🤝": Users,
      "🔒": Shield,
      "⏱️": Clock,
      "🍪": Cookie,
      "⚖️": Scale,
      "🌍": Globe,
      "👶": Baby,
      "📝": FileText,
    };
    return iconMap[iconName] || BarChart3;
  };
  const sections = [
    {
      id: "what-data",
      title: "1. Information We Collect",
      icon: "📊",
      content: [
        "We collect only the information necessary to provide and improve our services. This includes:",
        {
          type: "list",
          items: [
            "Account Information: Email address, name, profile picture, and authentication credentials",
            "User Content: Photos, videos, and other files you upload for AI generation purposes",
            "Generated Content: AI-generated images, videos, and other outputs created through our platform",
            "Payment Information: Billing details, transaction history, and credit usage records (processed securely through third-party payment processors)",
            "Usage Data: Information about how you interact with our services, including features used, generation preferences, and service performance metrics",
            "Technical Data: IP address, browser type, device information, and operating system for security and optimization purposes",
          ],
        },
        "We do not collect sensitive personal information such as health data, biometric information, or financial account details beyond what is necessary for payment processing.",
      ],
    },
    {
      id: "how-we-use",
      title: "2. How We Use Your Information",
      icon: "🎯",
      content: [
        "We use the collected information for the following purposes:",
        {
          type: "list",
          items: [
            "Service Delivery: To process AI generation requests, store and deliver your generated content, and maintain your account",
            "Billing and Payments: To process transactions, manage credit balances, send receipts, and handle refund requests",
            "Service Improvement: To analyze usage patterns, optimize performance, develop new features, and enhance user experience",
            "Communication: To send service updates, respond to support inquiries, and provide important notifications about your account",
            "Security: To detect and prevent fraud, abuse, and unauthorized access to our platform",
            "Legal Compliance: To comply with applicable laws, regulations, and legal processes",
          ],
        },
        "We never sell, rent, or share your personal information with third parties for their marketing purposes. Your data is used solely to operate and improve TheDigitalGifter services.",
      ],
    },
    {
      id: "sharing",
      title: "3. Information Sharing and Third Parties",
      icon: "🤝",
      content: [
        "We share your information only with trusted service providers who help us operate our platform:",
        {
          type: "list",
          items: [
            "Payment Processors: Stripe handles all payment transactions securely. We do not store complete credit card information on our servers",
            "AI Infrastructure Providers: Services like Replicate and Google AI process generation requests. We share only the necessary file URLs and generation parameters",
            "Cloud Storage: We use secure cloud storage providers to host uploaded files and generated content",
            "Analytics Services: We use privacy-focused analytics tools to understand usage patterns and improve our service",
            "Email Services: For sending transactional emails, account notifications, and support communications",
          ],
        },
        "All third-party providers are contractually obligated to protect your data and use it only for the specific purposes we've authorized. We minimize data exposure by sharing only what is strictly necessary for each service.",
        "We may also disclose information if required by law, to protect our rights, or to prevent fraud or abuse of our services.",
      ],
    },
    {
      id: "security",
      title: "4. Data Security and Protection",
      icon: "🔒",
      content: [
        "We implement comprehensive security measures to protect your information:",
        {
          type: "list",
          items: [
            "Encryption: All data transmitted to and from our servers uses industry-standard TLS encryption",
            "Secure Storage: Files and sensitive data are stored with encryption at rest",
            "Access Controls: Strict internal access policies limit employee access to user data on a need-to-know basis",
            "Authentication: Token-based authentication and secure session management protect your account",
            "Monitoring: We continuously monitor for suspicious activity, unauthorized access attempts, and security vulnerabilities",
            "Regular Audits: Security practices and systems are regularly reviewed and updated",
            "Key Management: API keys and credentials are stored securely and rotated regularly",
          ],
        },
        "While we implement robust security measures, no system is completely immune to security risks. We encourage you to use strong passwords and enable two-factor authentication when available.",
      ],
    },
    {
      id: "retention",
      title: "5. Data Retention",
      icon: "⏱️",
      content: [
        "We retain your information for as long as necessary to provide our services and fulfill the purposes described in this policy:",
        {
          type: "list",
          items: [
            "Account Information: Retained while your account is active and for a reasonable period after account closure for legal and business purposes",
            "Generated Content: Stored until you delete it or close your account, unless longer retention is required by law",
            "Transaction Records: Maintained for accounting, tax, and legal compliance purposes, typically for 7 years",
            "Usage Analytics: Aggregated and anonymized data may be retained indefinitely for service improvement",
          ],
        },
        "You can request deletion of your data at any time through your account settings or by contacting our support team. Please note that some information may be retained in backup systems for a limited time or as required by law.",
      ],
    },
    {
      id: "cookies",
      title: "6. Cookies and Tracking Technologies",
      icon: "🍪",
      content: [
        "We use cookies and similar technologies to enhance your experience and understand how our services are used:",
        {
          type: "list",
          items: [
            "Essential Cookies: Required for authentication, security, and core functionality",
            "Analytics Cookies: Help us understand usage patterns and improve our service",
            "Preference Cookies: Remember your settings and preferences",
          ],
        },
        "You can control cookie preferences through your browser settings. Disabling certain cookies may limit functionality of our services. We respect Do Not Track signals where applicable and required by law.",
      ],
    },
    {
      id: "your-rights",
      title: "7. Your Privacy Rights",
      icon: "⚖️",
      content: [
        "You have significant control over your personal information. Depending on your location, you may have the following rights:",
        {
          type: "list",
          items: [
            "Access: Request a copy of the personal information we hold about you",
            "Correction: Update or correct inaccurate or incomplete information",
            "Deletion: Request deletion of your personal information, subject to legal retention requirements",
            "Data Portability: Receive your data in a structured, machine-readable format",
            "Opt-Out: Unsubscribe from marketing communications (note: transactional emails are required for service operation)",
            "Objection: Object to certain types of data processing",
            "Withdraw Consent: Withdraw previously given consent for data processing",
          ],
        },
        "To exercise these rights, contact us at privacy@thedigitalgifter.com. We will respond to requests within the timeframe required by applicable law, typically within 30 days.",
        "For users in the European Union (GDPR), California (CCPA), and other jurisdictions with specific privacy regulations, we comply with all applicable requirements.",
      ],
    },
    {
      id: "international",
      title: "8. International Data Transfers",
      icon: "🌍",
      content: [
        "TheDigitalGifter operates globally, and your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place for international data transfers, including:",
        {
          type: "list",
          items: [
            "Standard Contractual Clauses approved by relevant authorities",
            "Adequacy decisions where available",
            "Appropriate security measures regardless of storage location",
          ],
        },
        "By using our services, you consent to the transfer of your information to countries that may have different data protection laws than your jurisdiction.",
      ],
    },
    {
      id: "children",
      title: "9. Children's Privacy",
      icon: "👶",
      content: [
        "Our services are not intended for users under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child under 18, we will take immediate steps to delete that information.",
        "If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at privacy@thedigitalgifter.com.",
      ],
    },
    {
      id: "changes",
      title: "10. Changes to This Policy",
      icon: "📝",
      content: [
        "We may update this Privacy Policy periodically to reflect changes in our practices, technology, legal requirements, or other factors. When we make material changes, we will:",
        {
          type: "list",
          items: [
            "Update the 'Effective Date' at the top of this policy",
            "Notify you via email or prominent notice on our platform",
            "Provide a summary of significant changes where appropriate",
          ],
        },
        "Your continued use of our services after changes take effect constitutes acceptance of the updated policy. We encourage you to review this policy periodically to stay informed about how we protect your information.",
      ],
    },
  ];

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    id: string
  ) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#060a12] to-[#0b1220]">
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>

      {/* Header Section */}
      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Lock size={28} className="text-[#ffd976]" />
                </div>
                <h1 className="text-4xl font-bold text-white tracking-tight">
                  Privacy Policy
                </h1>
              </div>
              <p className="text-white/60 text-sm font-medium">
                TheDigitalGifter Data Protection and Privacy Practices
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
                Effective Date
              </p>
              <p className="text-white/90 font-semibold">
                {new Date().toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Introduction */}
        <div className="mb-12 p-6 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-white/80 leading-relaxed mb-4">
            At TheDigitalGifter, we take your privacy seriously. This Privacy
            Policy explains how we collect, use, disclose, and safeguard your
            information when you use our AI-powered digital content generation
            services.
          </p>
          <p className="text-white/80 leading-relaxed">
            We are committed to protecting your personal data and being
            transparent about our practices. Please read this policy carefully
            to understand how we handle your information.
          </p>
        </div>

        {/* Table of Contents */}
        <nav
          aria-label="Table of contents"
          className="mb-12 p-6 bg-white/5 border border-white/10 rounded-lg"
        >
          <h2 className="text-xl font-bold text-white mb-4">
            Table of Contents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sections.map((section) => {
              const IconComponent = getIconComponent(section.icon);
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  onClick={(e) => scrollToSection(e, section.id)}
                  className="text-[#ffd976] hover:text-[#ffed9f] transition-colors text-sm font-medium flex items-start group"
                >
                  <div className="mr-2 mt-0.5 flex-shrink-0">
                    <IconComponent size={16} className="text-[#ffd976]" />
                  </div>
                  <span>{section.title}</span>
                </a>
              );
            })}
          </div>
        </nav>

        {/* Content Sections */}
        <article id="main-content" className="space-y-8">
          {sections.map((section) => {
            const IconComponent = getIconComponent(section.icon);
            return (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-32 p-8 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
              >
                <div className="flex items-start gap-3 mb-6 pb-3 border-b border-white/10">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <IconComponent size={18} className="text-[#ffd976]" />
                  </div>
                  <h2 className="text-2xl font-bold text-white flex-1">
                    {section.title}
                  </h2>
                </div>
                <div className="space-y-4">
                  {section.content.map((item, idx) => {
                    if (typeof item === "string") {
                      return (
                        <p
                          key={idx}
                          className="text-white/70 leading-relaxed text-[15px]"
                        >
                          {item}
                        </p>
                      );
                    } else if (item.type === "list") {
                      return (
                        <ul key={idx} className="space-y-3 ml-4">
                          {item.items.map((listItem, listIdx) => (
                            <li
                              key={listIdx}
                              className="text-white/70 leading-relaxed text-[15px] flex items-start"
                            >
                              <span className="text-[#ffd976] mr-3 mt-1">
                                •
                              </span>
                              <span className="flex-1">{listItem}</span>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                    return null;
                  })}
                </div>
              </section>
            );
          })}
        </article>

        {/* Contact Section */}
        <div className="mt-12 p-8 bg-gradient-to-r from-[#ffd976]/10 to-[#ffd976]/5 border border-[#ffd976]/20 rounded-lg">
          <h3 className="text-xl font-bold text-white mb-4">
            Privacy Questions or Requests?
          </h3>
          <p className="text-white/70 leading-relaxed mb-4">
            If you have questions about this Privacy Policy, wish to exercise
            your privacy rights, or have concerns about how we handle your data,
            please contact our privacy team.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:privacy@thedigitalgifter.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#ffd976]/20 hover:bg-[#ffd976]/30 border border-[#ffd976]/30 rounded-lg text-[#ffd976] font-medium transition-all"
            >
              <div className="mr-2 p-1 rounded bg-white/5 flex items-center justify-center">
                <Mail size={16} />
              </div>
              privacy@thedigitalgifter.com
            </a>
            <a
              href="mailto:support@thedigitalgifter.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white font-medium transition-all"
            >
              <div className="mr-2 p-1 rounded bg-white/5 flex items-center justify-center">
                <HelpCircle size={16} />
              </div>
              support@thedigitalgifter.com
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-sm text-white/60 leading-relaxed">
            <strong className="text-white/80">Legal Notice:</strong> This
            Privacy Policy is provided for informational purposes and reflects
            our current data protection practices. It is not legal advice. For
            jurisdiction-specific requirements (GDPR, CCPA, etc.) or enterprise
            privacy agreements, please consult with legal counsel or contact our
            legal team.
          </p>
        </div>
      </div>
    </main>
  );
}
