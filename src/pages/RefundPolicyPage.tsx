import React from "react";
import {
  Clipboard,
  CheckCircle,
  XCircle,
  Mail,
  Clock,
  Split,
  Zap,
  Building2,
  BarChart3,
  FileText,
} from "lucide-react";

export function RefundPolicyPage() {
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      "📋": Clipboard,
      "✅": CheckCircle,
      "❌": XCircle,
      "📧": Mail,
      "⏱️": Clock,
      "➗": Split,
      "⚡": Zap,
      "🏢": Building2,
      "📊": BarChart3,
      "📝": FileText,
    };
    return iconMap[iconName] || Clipboard;
  };
  const sections = [
    {
      id: "overview",
      title: "1. Refund Policy Overview",
      icon: "📋",
      content: [
        "At TheDigitalGifter, we strive to provide high-quality AI generation services and ensure customer satisfaction. However, due to the nature of digital content and AI processing, our refund policy has specific terms and conditions.",
        "Credits purchased on our platform are generally non-refundable once used for AI generation purposes. This is because:",
        {
          type: "list",
          items: [
            "AI processing consumes computational resources immediately upon generation",
            "Generated content is delivered instantly and cannot be 'returned'",
            "Our costs for infrastructure and AI services are incurred at the time of generation",
          ],
        },
        "However, we recognize that exceptional circumstances may arise, and we evaluate refund requests on a case-by-case basis with fairness and reasonableness.",
      ],
    },
    {
      id: "eligible",
      title: "2. When Refunds May Be Granted",
      icon: "✅",
      content: [
        "We may consider refund requests in the following situations:",
        {
          type: "subsections",
          items: [
            {
              title: "Technical Failures",
              description:
                "Repeated system errors or service outages that prevented you from using purchased credits despite multiple attempts. This includes server failures, API errors, or generation failures not caused by user input.",
            },
            {
              title: "Duplicate Charges",
              description:
                "Accidental multiple charges for the same transaction due to system errors or payment processing issues. We will refund duplicate charges promptly upon verification.",
            },
            {
              title: "Fraudulent Activity",
              description:
                "Confirmed unauthorized charges on your account resulting from security breaches or fraudulent access. We investigate such cases thoroughly and work with affected users to resolve issues.",
            },
            {
              title: "Service Not as Described",
              description:
                "If the service fundamentally fails to deliver the advertised functionality, and this is verified by our technical team.",
            },
            {
              title: "Pre-Use Cancellation",
              description:
                "If you request a refund for unused credits within 48 hours of purchase and have not used any portion of the purchased credits for generation.",
            },
          ],
        },
      ],
    },
    {
      id: "ineligible",
      title: "3. When Refunds Will Not Be Granted",
      icon: "❌",
      content: [
        "Refunds will generally not be provided in the following circumstances:",
        {
          type: "list",
          items: [
            "Credits have been used for AI generation, regardless of satisfaction with output quality",
            "User error in generation parameters, prompts, or uploaded content",
            "Dissatisfaction with generated content that meets technical specifications",
            "Change of mind after purchase or after using credits",
            "Account suspension or termination due to violation of Terms of Service",
            "Credits purchased more than 14 days ago (unless covered by exceptions above)",
            "Promotional or discounted credits obtained through special offers",
          ],
        },
        "Our AI generation quality depends on many factors including input quality, prompt clarity, and the inherent limitations of AI technology. We cannot guarantee specific artistic outcomes.",
      ],
    },
    {
      id: "process",
      title: "4. How to Request a Refund",
      icon: "📧",
      content: [
        "If you believe you qualify for a refund under our policy, please follow these steps:",
        {
          type: "numbered",
          items: [
            "Contact our support team at support@thedigitalgifter.com within 14 days of the transaction",
            "Include your order/transaction ID, account email, and purchase date",
            "Provide a detailed explanation of the issue and why you're requesting a refund",
            "If applicable, include screenshots or error messages that demonstrate the problem",
            "Attach any relevant documentation that supports your refund request",
          ],
        },
        "Our support team will review your request within 2-3 business days and respond with next steps. If additional information is needed, we will contact you promptly.",
        "Approved refunds will be processed within 5-10 business days and issued to the original payment method. Please note that it may take additional time for your financial institution to process the refund.",
      ],
    },
    {
      id: "processing",
      title: "5. Refund Processing Time",
      icon: "⏱️",
      content: [
        "Once a refund is approved, the timeline for receiving your funds depends on several factors:",
        {
          type: "list",
          items: [
            "Processing Time: 5-10 business days from approval for us to process the refund",
            "Bank Processing: Additional 3-7 business days for your financial institution to credit your account",
            "Credit Card Refunds: Appear as a credit on your statement, typically within 1-2 billing cycles",
            "PayPal/Digital Wallet: Generally faster, usually within 1-3 business days after processing",
          ],
        },
        "In total, you should expect to receive your refund within 14 business days of approval. If you have not received your refund after this period, please check with your financial institution first, then contact us for assistance.",
      ],
    },
    {
      id: "partial",
      title: "6. Partial Refunds",
      icon: "➗",
      content: [
        "In certain situations, we may offer partial refunds:",
        {
          type: "list",
          items: [
            "If you've used some but not all credits from a purchased package before experiencing technical issues",
            "When service degradation affected but didn't completely prevent usage",
            "As a goodwill gesture for minor inconveniences or delays",
          ],
        },
        "Partial refunds are calculated based on the unused portion of credits and the specific circumstances of your case. Our support team will clearly explain any partial refund offer before processing.",
      ],
    },
    {
      id: "alternatives",
      title: "7. Alternatives to Refunds",
      icon: "🔄",
      content: [
        "Instead of a monetary refund, we may offer alternative solutions:",
        {
          type: "list",
          items: [
            "Credit Restoration: Adding back credits that were lost due to system errors",
            "Bonus Credits: Complementary credits as compensation for service issues",
            "Extended Access: Additional time or features to make up for disruptions",
            "Technical Support: Priority assistance to resolve generation issues",
          ],
        },
        "These alternatives may provide faster resolution and better value than processing refunds. Our team will discuss options with you to find the best solution.",
      ],
    },
    {
      id: "enterprise",
      title: "8. Enterprise and Custom Agreements",
      icon: "🏢",
      content: [
        "Enterprise customers and those with custom service agreements may have different refund terms:",
        {
          type: "list",
          items: [
            "Custom SLA agreements with specific performance guarantees and refund provisions",
            "Volume-based refund policies for large credit purchases",
            "Dedicated account management for dispute resolution",
            "Priority processing for refund requests",
          ],
        },
        "If you're interested in enterprise services with tailored refund policies, contact our sales team at sales@thedigitalgifter.com to discuss custom agreements that meet your organization's needs.",
      ],
    },
    {
      id: "disputes",
      title: "9. Dispute Resolution",
      icon: "⚖️",
      content: [
        "If you disagree with a refund decision, you have the following options:",
        {
          type: "list",
          items: [
            "Request a review by a senior support manager by replying to the refund decision email",
            "Provide additional evidence or information that wasn't considered in the initial review",
            "Contact our customer service leadership team for escalation",
          ],
        },
        "We are committed to fair treatment and will thoroughly review all disputes. Most disputes are resolved within 5-7 business days of escalation.",
        "For unresolved disputes, refer to the dispute resolution procedures outlined in our Terms and Conditions.",
      ],
    },
    {
      id: "changes",
      title: "10. Changes to This Policy",
      icon: "📝",
      content: [
        "We reserve the right to modify this Refund Policy at any time. Changes will be effective immediately upon posting to our website. Material changes will be communicated via:",
        {
          type: "list",
          items: [
            "Email notification to registered users",
            "Prominent notice on our platform homepage",
            "In-app notifications for active users",
          ],
        },
        "Refund requests submitted before policy changes will be evaluated under the policy in effect at the time of purchase. We encourage you to review this policy periodically.",
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

  const renderContent = (item: any, idx: number) => {
    if (typeof item === "string") {
      return (
        <p key={idx} className="text-white/70 leading-relaxed text-[15px]">
          {item}
        </p>
      );
    }

    if (item.type === "list") {
      return (
        <ul key={idx} className="space-y-3 ml-4">
          {item.items.map((listItem: string, listIdx: number) => (
            <li
              key={listIdx}
              className="text-white/70 leading-relaxed text-[15px] flex items-start"
            >
              <span className="text-[#ffd976] mr-3 mt-1">•</span>
              <span className="flex-1">{listItem}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (item.type === "numbered") {
      return (
        <ol key={idx} className="space-y-3 ml-4">
          {item.items.map((listItem: string, listIdx: number) => (
            <li
              key={listIdx}
              className="text-white/70 leading-relaxed text-[15px] flex items-start"
            >
              <span className="text-[#ffd976] mr-3 font-semibold">
                {listIdx + 1}.
              </span>
              <span className="flex-1">{listItem}</span>
            </li>
          ))}
        </ol>
      );
    }

    if (item.type === "subsections") {
      return (
        <div key={idx} className="space-y-4 ml-2">
          {item.items.map((subsection: any, subIdx: number) => (
            <div
              key={subIdx}
              className="p-4 bg-white/5 rounded-lg border border-white/10"
            >
              <h4 className="text-white font-semibold mb-2 text-[15px]">
                {subsection.title}
              </h4>
              <p className="text-white/70 leading-relaxed text-[15px]">
                {subsection.description}
              </p>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#060a12] to-[#0b1220]">
      {/* Header Section */}
      <div className="border-b border-white/10 bg-[#060a12]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <Split size={28} className="text-[#ffd976]" />
                </div>
                <h1 className="text-4xl font-bold text-white tracking-tight">
                  Refund Policy
                </h1>
              </div>
              <p className="text-white/60 text-sm font-medium">
                TheDigitalGifter Refund Terms and Procedures
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
            This Refund Policy outlines the terms and conditions under which
            TheDigitalGifter may issue refunds for purchased credits. We are
            committed to customer satisfaction while maintaining fair practices
            for our digital services.
          </p>
          <p className="text-white/80 leading-relaxed">
            Please read this policy carefully before making a purchase. By
            purchasing credits, you acknowledge and agree to the terms outlined
            below.
          </p>
        </div>

        {/* Quick Summary Card */}
        <div className="mb-12 p-6 bg-gradient-to-r from-[#ffd976]/10 to-[#ffd976]/5 border border-[#ffd976]/20 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
              <Zap size={18} className="text-[#ffd976]" />
            </div>
            Quick Summary
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="text-white/90 font-medium flex items-center gap-2">
                <div className="p-1 rounded bg-white/5 flex items-center justify-center">
                  <CheckCircle size={16} className="text-green-400" />
                </div>
                Refunds Available For:
              </p>
              <ul className="text-white/70 space-y-1 ml-4">
                <li>• Technical failures</li>
                <li>• Duplicate charges</li>
                <li>• Unused credits (48hrs)</li>
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-white/90 font-medium flex items-center gap-2">
                <div className="p-1 rounded bg-white/5 flex items-center justify-center">
                  <Clock size={16} className="text-[#ffd976]" />
                </div>
                Important Timelines:
              </p>
              <ul className="text-white/70 space-y-1 ml-4">
                <li>• Request within 14 days</li>
                <li>• Review in 2-3 business days</li>
                <li>• Processing in 5-10 days</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-white/5 border border-white/10 rounded-lg">
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
        <div className="space-y-8">
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
                  {section.content.map((item, idx) => renderContent(item, idx))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Contact Section */}
        <div className="mt-12 p-8 bg-gradient-to-r from-[#ffd976]/10 to-[#ffd976]/5 border border-[#ffd976]/20 rounded-lg">
          <h3 className="text-xl font-bold text-white mb-4">
            Need to Request a Refund?
          </h3>
          <p className="text-white/70 leading-relaxed mb-6">
            If you believe you qualify for a refund, please contact our support
            team with your transaction details. We're here to help resolve any
            issues fairly and promptly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:support@thedigitalgifter.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#ffd976]/20 hover:bg-[#ffd976]/30 border border-[#ffd976]/30 rounded-lg text-[#ffd976] font-medium transition-all"
            >
              <div className="mr-2 p-1 rounded bg-white/5 flex items-center justify-center">
                <Mail size={16} />
              </div>
              support@thedigitalgifter.com
            </a>
            <a
              href="mailto:sales@thedigitalgifter.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white font-medium transition-all"
            >
              <div className="mr-2 p-1 rounded bg-white/5 flex items-center justify-center">
                <Building2 size={16} />
              </div>
              Enterprise Inquiries
            </a>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-sm text-white/60 leading-relaxed">
            <strong className="text-white/80">Note:</strong> This Refund Policy
            is part of our Terms and Conditions and should be read in
            conjunction with our Privacy Policy. For enterprise customers,
            custom refund terms may apply as specified in your service
            agreement. This policy may be updated periodically, and we will
            notify users of material changes.
          </p>
        </div>
      </div>
    </main>
  );
}
