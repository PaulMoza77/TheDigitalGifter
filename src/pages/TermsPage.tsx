import React from "react";
import {
  FileText,
  User,
  CreditCard,
  AlertCircle,
  Copyright,
  AlertTriangle,
  Power,
  Scale,
  Settings,
  Mail,
  Briefcase,
} from "lucide-react";

export function TermsPage() {
  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      "1": FileText,
      "2": User,
      "3": CreditCard,
      "4": AlertCircle,
      "5": Copyright,
      "6": AlertTriangle,
      "7": Power,
      "8": Scale,
      "9": Settings,
    };
    return iconMap[iconName] || FileText;
  };
  const sections = [
    {
      id: "agreement",
      title: "1. Agreement to Terms",
      content: [
        "By accessing or using TheDigitalGifter's services, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. These Terms constitute a legally binding agreement between you and TheDigitalGifter.",
        "We reserve the right to modify these Terms at any time. Material changes will be communicated through our platform or via email. Your continued use of our services following any modifications constitutes acceptance of the updated Terms.",
        "If you do not agree to these Terms, you must discontinue use of our services immediately.",
      ],
    },
    {
      id: "accounts",
      title: "2. User Accounts and Registration",
      content: [
        "To access certain features of our services, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to maintain its accuracy.",
        "You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. We support authentication through Google OAuth and standard email/password methods.",
        "You must immediately notify us of any unauthorized use of your account or any other security breach. We cannot and will not be liable for any loss or damage arising from your failure to comply with these security obligations.",
        "You must be at least 18 years of age to create an account and use our services.",
      ],
    },
    {
      id: "credits",
      title: "3. Credits, Billing, and Payment",
      content: [
        "Our services operate on a credit-based system. Credits are purchased in packages as displayed within the application. Each AI generation or service action consumes a specified number of credits.",
        "All prices are displayed in USD and are subject to change with reasonable notice. Previously purchased credits will remain valid and honor the terms under which they were purchased.",
        "Payments are processed securely through our third-party payment processors. By providing payment information, you represent that you are authorized to use the payment method provided.",
        "Credits are non-transferable and cannot be exchanged for cash. Refunds are handled on a case-by-case basis in accordance with our refund policy. Please contact support for refund requests within 14 days of purchase.",
        "We reserve the right to modify credit pricing and package offerings. Existing purchased credits will not be affected by such changes.",
      ],
    },
    {
      id: "acceptable",
      title: "4. Acceptable Use Policy",
      content: [
        "You agree to use our services only for lawful purposes and in accordance with these Terms. You are prohibited from:",
        "• Uploading, transmitting, or sharing content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable",
        "• Infringing upon intellectual property rights of others, including copyrights, trademarks, or patents",
        "• Engaging in any activity that disrupts or interferes with our services or servers",
        "• Attempting to gain unauthorized access to any portion of our services or systems",
        "• Using our services for any automated or systematic data collection without express written permission",
        "We reserve the right to investigate violations and to take appropriate action, including suspension or termination of accounts, reporting to law enforcement authorities, and pursuing legal remedies.",
      ],
    },
    {
      id: "intellectual",
      title: "5. Intellectual Property Rights",
      content: [
        "All content, features, and functionality of our services, including but not limited to text, graphics, logos, icons, images, software, and their selection and arrangement, are the exclusive property of TheDigitalGifter and are protected by copyright, trademark, and other intellectual property laws.",
        "Generated content created using our AI services may be subject to your ownership rights, provided you have complied with these Terms and all applicable laws. However, we retain a limited license to use generated content for service improvement and operational purposes.",
        "You grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, and display content you upload solely for the purpose of providing our services to you.",
      ],
    },
    {
      id: "liability",
      title: "6. Limitation of Liability",
      content: [
        "Our services are provided on an 'as-is' and 'as-available' basis without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.",
        "To the maximum extent permitted by applicable law, TheDigitalGifter shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.",
        "Our total liability to you for all claims arising from or related to our services shall not exceed the total amount paid by you to TheDigitalGifter in the twelve (12) months preceding the claim.",
        "Some jurisdictions do not allow the exclusion of certain warranties or the limitation of liability for incidental or consequential damages. In such jurisdictions, our liability will be limited to the greatest extent permitted by law.",
      ],
    },
    {
      id: "termination",
      title: "7. Termination",
      content: [
        "We reserve the right to suspend or terminate your account and access to our services at our sole discretion, without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties, or for any other reason.",
        "Upon termination, your right to use our services will immediately cease. Unused credits may be forfeited upon termination for cause. You may request account deletion at any time through your account settings or by contacting support.",
      ],
    },
    {
      id: "governing",
      title: "8. Governing Law and Dispute Resolution",
      content: [
        "These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which TheDigitalGifter operates, without regard to its conflict of law provisions.",
        "Any dispute arising from these Terms or our services shall first be attempted to be resolved through good faith negotiations. If a resolution cannot be reached, disputes shall be resolved through binding arbitration in accordance with applicable arbitration rules.",
        "You agree to waive any right to a jury trial or to participate in a class action lawsuit.",
      ],
    },
    {
      id: "general",
      title: "9. General Provisions",
      content: [
        "These Terms constitute the entire agreement between you and TheDigitalGifter regarding our services and supersede all prior agreements and understandings.",
        "Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.",
        "If any provision of these Terms is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect.",
        "You may not assign or transfer these Terms or your rights and obligations under these Terms without our prior written consent.",
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
      {/* Header Section */}
      <div className="border-b border-white/10 bg-[#060a12]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                Terms & Conditions
              </h1>
              <p className="text-white/60 text-sm font-medium">
                TheDigitalGifter Service Agreement
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">
                Last Updated
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
          <p className="text-white/80 leading-relaxed">
            Please read these Terms and Conditions carefully before using
            TheDigitalGifter's services. These terms govern your access to and
            use of our platform, including any content, functionality, and
            services offered. By accessing or using our services, you agree to
            be bound by these terms.
          </p>
        </div>

        {/* Table of Contents */}
        <nav className="mb-12 p-6 bg-white/5 border border-white/10 rounded-lg">
          <h2 className="text-xl font-bold text-white mb-4">
            Table of Contents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sections.map((section, idx) => {
              const IconComponent = getIconComponent((idx + 1).toString());
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
          {sections.map((section, idx) => {
            const IconComponent = getIconComponent((idx + 1).toString());
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
                  {section.content.map((paragraph, idx) => (
                    <p
                      key={idx}
                      className="text-white/70 leading-relaxed text-[15px]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Contact Section */}
        <div className="mt-12 p-8 bg-gradient-to-r from-[#ffd976]/10 to-[#ffd976]/5 border border-[#ffd976]/20 rounded-lg">
          <h3 className="text-xl font-bold text-white mb-4">
            Questions or Concerns?
          </h3>
          <p className="text-white/70 leading-relaxed mb-4">
            If you have any questions about these Terms and Conditions, require
            clarification on any provisions, or need to discuss enterprise
            agreements, please don't hesitate to reach out to our team.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="mailto:legal@thedigitalgifter.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white font-medium transition-all"
            >
              <div className="mr-2 p-1 rounded bg-white/5 flex items-center justify-center">
                <Mail size={16} />
              </div>
              legal@thedigitalgifter.com
            </a>
            <a
              href="mailto:sales@thedigitalgifter.com"
              className="inline-flex items-center justify-center px-6 py-3 bg-[#ffd976]/20 hover:bg-[#ffd976]/30 border border-[#ffd976]/30 rounded-lg text-[#ffd976] font-medium transition-all"
            >
              <div className="mr-2 p-1 rounded bg-white/5 flex items-center justify-center">
                <Briefcase size={16} />
              </div>
              sales@thedigitalgifter.com
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
