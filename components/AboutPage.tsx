"use client";

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-white font-bold text-2xl">🔨</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">DeliveryForge</h1>
            <p className="text-slate-700">
              Transform raw requirements into complete delivery plans with complexity analysis, strategy proposals, and comprehensive project timelines.
            </p>
          </div>
        </div>
      </div>

      {/* The Platform */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">What is DeliveryForge?</h2>
        <div className="p-6 bg-white rounded-lg border border-slate-200 space-y-3">
          <p className="text-slate-700">
            DeliveryForge is an <strong>enterprise delivery planning platform</strong> that transforms customer requirements into justified, comprehensive project plans. Using McCabe's Cyclomatic Complexity analysis, it generates:
          </p>
          <ul className="text-slate-700 space-y-2 ml-4">
            <li>✅ Dual complexity analysis (development + testing)</li>
            <li>✅ Effort estimation with man-days calculation</li>
            <li>✅ Auto-generated user stories with story points</li>
            <li>✅ Comprehensive project timelines with phases</li>
            <li>✅ Professional use case document generation</li>
          </ul>
          <p className="text-slate-700 text-sm italic">
            No more guessing. No more estimations without justification. Every plan is backed by scientific complexity analysis.
          </p>
        </div>
      </section>

      {/* The Science */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">The Science: McCabe's Cyclomatic Complexity</h2>
        <div className="p-6 bg-white rounded-lg border border-slate-200 space-y-3">
          <p className="text-slate-700">
            <strong>McCabe's Cyclomatic Complexity (M)</strong> measures how many independent paths exist through a software system. DeliveryForge applies this proven metric to:
          </p>
          <ul className="text-slate-700 space-y-1 ml-4">
            <li>• Calculate <strong>development complexity</strong> - how hard is it to build?</li>
            <li>• Calculate <strong>testing complexity</strong> - how hard is it to test?</li>
            <li>• Identify <strong>risk factors</strong> - what could go wrong?</li>
            <li>• Estimate <strong>realistic timelines</strong> - how long will it take?</li>
            <li>• Justify <strong>team allocation</strong> - who do we need?</li>
          </ul>
          <div className="bg-slate-50 p-4 rounded border border-slate-200 font-mono text-sm mt-3">
            <p className="text-slate-900"><strong>Formula:</strong> M = E - N + 2P</p>
            <ul className="mt-2 text-slate-700 space-y-1">
              <li>• <strong>E</strong> = Number of edges (transitions/connections)</li>
              <li>• <strong>N</strong> = Number of nodes (decision points/states)</li>
              <li>• <strong>2P</strong> = Twice the connected components (test scenarios)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* The Workflow */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">The Workflow: From Requirement to Delivery Plan</h2>
        <div className="space-y-3">
          {[
            { num: "1", title: "📝 Enter Requirement", desc: "Paste raw customer brief, upload text file, or provide website URL. Any format works." },
            { num: "2", title: "📊 Complexity Analysis", desc: "Calculate dual complexity: development difficulty vs. testing difficulty. Get nodes, edges, paths, and man-days." },
            { num: "3", title: "📋 User Stories", desc: "AI generates comprehensive user stories with acceptance criteria, story points, and priority levels." },
            { num: "4", title: "📅 Project Timeline", desc: "Auto-generates project timeline with phases, milestones, team allocation, and budget breakdown." },
            { num: "5", title: "📄 Use Case Document", desc: "Generate professional use case documentation from complexity analysis for stakeholder review." },
          ].map((step) => (
            <div key={step.num} className="p-6 bg-white rounded-lg border border-slate-200">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                  {step.num}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-700 text-sm">{step.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Key Features */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: "🤖", title: "AI-Powered Analysis", desc: "Claude AI analyzes requirements and generates comprehensive plans deterministically." },
            { icon: "🔬", title: "Science-Backed", desc: "Uses McCabe's Cyclomatic Complexity—a proven metric trusted by Fortune 500 companies for 40+ years." },
            { icon: "📊", title: "Dual Complexity Analysis", desc: "Separate complexity scores for development and testing to guide resource allocation." },
            { icon: "⏱️", title: "Effort Estimation", desc: "Automatic calculation of man-days for development and QA based on complexity metrics." },
            { icon: "📖", title: "User Story Generation", desc: "AI-generated user stories with story points, acceptance criteria, and priority levels." },
            { icon: "📅", title: "Timeline Planning", desc: "Realistic project timelines with phases, milestones, and parallel execution paths." },
            { icon: "📄", title: "Use Case Documents", desc: "Professional use case documentation generation for stakeholder review and approval." },
            { icon: "🎯", title: "Data-Driven Planning", desc: "All estimates backed by scientific complexity analysis, not intuition or guesswork." },
          ].map((feature, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-3xl mb-2">{feature.icon}</div>
              <h3 className="font-bold text-slate-900 mb-1">{feature.title}</h3>
              <p className="text-sm text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Complexity Levels */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Understanding Complexity Levels</h2>
        <div className="space-y-3">
          {[
            { level: "🟢 Low (1-10)", approach: "Streamlined process, minimal risk, fast delivery", timeline: "1-2 weeks" },
            { level: "🟡 Medium (11-20)", approach: "Standard phased approach, moderate risk", timeline: "2-4 weeks" },
            { level: "🟠 High (21-30)", approach: "Extended testing cycles, risk mitigation", timeline: "1-2 months" },
            { level: "🔴 Very High (31+)", approach: "Multiple releases, dedicated QA team, contingency", timeline: "2+ months" },
          ].map((item, i) => (
            <div key={i} className="p-4 bg-white rounded-lg border border-slate-200">
              <p className="font-bold text-slate-900 mb-1">{item.level}</p>
              <p className="text-sm text-slate-700"><strong>Approach:</strong> {item.approach}</p>
              <p className="text-sm text-slate-700"><strong>Timeline:</strong> {item.timeline}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Dashboard Tabs */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Tabs</h2>
        <div className="space-y-3">
          {[
            { name: "📝 Requirement Analysis", desc: "Input requirement and perform initial analysis" },
            { name: "📚 Analysis History", desc: "View all past requirement analyses" },
            { name: "📖 User Stories", desc: "AI-generated user stories with story points & acceptance criteria" },
            { name: "💡 Proposed Estimation", desc: "View estimated effort and timelines" },
            { name: "📊 Estimation History", desc: "Track all estimation records and QA/Dev effort breakdowns" },
            { name: "📅 Project Timeline", desc: "Visualize project phases and timeline for the requirement" },
            { name: "💾 Project Plans History", desc: "Save and manage delivery plans and timelines" },
            { name: "ℹ️ About", desc: "Platform information and best practices" },
          ].map((tab, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded border border-slate-200">
              <p className="font-semibold text-slate-900">{tab.name}</p>
              <p className="text-sm text-slate-600">{tab.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Who Uses DeliveryForge?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { role: "Product Managers", use: "Justify estimates to stakeholders with science-backed data" },
            { role: "QA Leaders", use: "Plan testing strategies and calculate realistic QA timelines" },
            { role: "Tech Leads", use: "Estimate development effort and allocate development resources" },
            { role: "Project Managers", use: "Create comprehensive project plans with budgets & risks" },
            { role: "CTOs", use: "Make data-driven decisions on project prioritization" },
            { role: "Executives", use: "Understand project complexity before approving initiatives" },
          ].map((item, i) => (
            <div key={i} className="p-4 bg-white rounded-lg border border-slate-200">
              <p className="font-bold text-slate-900">{item.role}</p>
              <p className="text-sm text-slate-600">{item.use}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Best Practices */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Best Practices</h2>
        <div className="p-6 bg-white rounded-lg border border-slate-200 space-y-3">
          <div className="flex gap-3">
            <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-slate-900">Be Comprehensive</p>
              <p className="text-sm text-slate-600">The more detail you provide, the more accurate the complexity analysis</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-slate-900">Include Edge Cases</p>
              <p className="text-sm text-slate-600">Mention error scenarios, integrations, and special conditions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-slate-900">Refinement Questions</p>
              <p className="text-sm text-slate-600">Answer all clarifying questions thoroughly to improve accuracy</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-slate-900">Use for Planning</p>
              <p className="text-sm text-slate-600">Use complexity scores to justify team allocation and timelines</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-600 font-bold flex-shrink-0">✓</span>
            <div>
              <p className="font-semibold text-slate-900">Track Actuals</p>
              <p className="text-sm text-slate-600">Compare planned vs. actual effort to improve future estimates</p>
            </div>
          </div>
        </div>
      </section>

      {/* Support */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-slate-900">Support</h2>
        <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-slate-700 mb-3">
            DeliveryForge is built to transform how organizations plan and deliver projects. Every analysis is science-backed, every plan is justified, and every timeline is realistic.
          </p>
          <p className="text-sm text-slate-600">
            Built for teams that demand accuracy in delivery planning.
          </p>
        </div>
      </section>
    </div>
  );
}
