import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function Home() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-lg">🔨</span>
            </div>
            <div>
              <span className="font-bold text-xl text-slate-900 block">DeliveryForge</span>
              <span className="text-xs text-slate-500">Requirements to Delivery Plans</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/login">
              <button className="px-5 py-2 text-slate-700 hover:text-slate-900 font-semibold transition-colors">
                Sign In
              </button>
            </Link>
            <Link href="/signup">
              <button className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg font-semibold transition-all">
                Start Free
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 sm:py-32 bg-gradient-to-b from-slate-50 via-white to-slate-50">
        <div className="max-w-3xl text-center space-y-8">
          {/* Badge */}
          <div className="inline-block">
            <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
              🔨 AI-Powered Delivery Planning
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-6xl sm:text-7xl font-bold text-slate-900 leading-tight">
            Transform Requirements Into
            <span className="bg-gradient-to-r from-blue-600 to-blue-700 text-transparent bg-clip-text block mt-2">
              Complete Delivery Plans
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-xl sm:text-2xl text-slate-600 leading-relaxed font-light">
            From raw requirements to complete delivery plans. Get requirement classification, complexity analysis, testing strategy, development strategy, and a comprehensive go-live plan—all in minutes.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <Link href="/signup">
              <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-2xl font-bold text-lg transition-all transform hover:scale-105">
                Get Started Free →
              </button>
            </Link>
            <Link href="#features">
              <button className="px-8 py-4 border-2 border-slate-300 text-slate-900 rounded-lg hover:border-slate-400 font-bold text-lg transition-all">
                See How It Works
              </button>
            </Link>
          </div>

        </div>

        {/* Stats Section */}
        <div className="max-w-5xl mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <div className="p-8 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">10x</div>
            <p className="text-slate-600 font-medium">Faster Test Planning</p>
            <p className="text-xs text-slate-500 mt-1">vs. manual estimation</p>
          </div>
          <div className="p-8 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">100%</div>
            <p className="text-slate-600 font-medium">Coverage Justified</p>
            <p className="text-xs text-slate-500 mt-1">With McCabe's formula</p>
          </div>
          <div className="p-8 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">0%</div>
            <p className="text-slate-600 font-medium">Guesswork</p>
            <p className="text-xs text-slate-500 mt-1">Data-driven decisions</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-32 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Complete Testing Workflow
            </h2>
            <p className="text-xl text-slate-600">Everything you need from requirement to deployment</p>
          </div>

          {/* 6 Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: "📝", title: "Smart Requirement Refinement", desc: "AI generates 10-15 clarifying questions to eliminate ambiguity" },
              { icon: "🧮", title: "McCabe's Complexity Analysis", desc: "Calculate M = E - N + 2P for precise test coverage" },
              { icon: "📋", title: "Test Scenario Generation", desc: "Auto-generate all distinct test cases with preconditions & steps" },
              { icon: "📊", title: "Effort Estimation", desc: "Calculate QA & Dev man-days based on complexity" },
              { icon: "📖", title: "User Story Generation", desc: "Create 8-12 comprehensive stories with acceptance criteria" },
              { icon: "📅", title: "Gantt Chart Timeline", desc: "Visual project plan with Design→Dev→QA→Deploy phases" },
            ].map((feature, i) => (
              <div key={i} className="p-8 bg-slate-50 rounded-xl border border-slate-200 hover:shadow-lg transition-all">
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-slate-600 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points → Solutions */}
      <section className="py-20 sm:py-32 px-4 bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 text-center mb-16">
            Stop Guessing. Start Justifying.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                problem: "❌ How many tests do we really need?",
                solution: "✅ Exact count calculated from requirement complexity"
              },
              {
                problem: "❌ Why are estimates always wrong?",
                solution: "✅ Scientific estimation based on proven metrics"
              },
              {
                problem: "❌ Can I justify this to stakeholders?",
                solution: "✅ McCabe's formula backed by 40+ years of research"
              },
              {
                problem: "❌ How long will this actually take?",
                solution: "✅ Timeline & effort breakdown by phase"
              },
              {
                problem: "❌ What if we miss edge cases?",
                solution: "✅ AI identifies all paths & scenarios automatically"
              },
              {
                problem: "❌ How do we organize our test work?",
                solution: "✅ Ready-to-use user stories & Gantt charts"
              },
            ].map((item, i) => (
              <div key={i} className="p-6 bg-white rounded-lg border border-slate-200">
                <p className="text-lg font-semibold text-slate-900 mb-3">{item.problem}</p>
                <p className="text-slate-600">{item.solution}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 sm:py-32 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-slate-900 text-center mb-16">How It Works</h2>

          <div className="space-y-8">
            {[
              { step: "1", title: "Paste Your Requirement", desc: "BRS, FRS, user story, or website URL—any format" },
              { step: "2", title: "Refine with AI Questions", desc: "Answer clarifying questions to build comprehensive specs" },
              { step: "3", title: "Get Complexity Score", desc: "View detailed analysis with M value & test scenario count" },
              { step: "4", title: "Extract Test Scenarios", desc: "Download all scenarios as Excel for team distribution" },
              { step: "5", title: "View User Stories & Timeline", desc: "Auto-generated stories, story points, and Gantt chart" },
              { step: "6", title: "Plan & Execute", desc: "Teams use this data to scope, estimate, and execute QA" },
            ].map((item, i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-1">{item.title}</h3>
                  <p className="text-slate-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose DeliveryForge */}
      <section className="py-20 sm:py-32 px-4 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-slate-900 text-center mb-16">Why DeliveryForge?</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 bg-white rounded-xl border border-slate-200">
              <div className="text-3xl mb-3">🔬</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Science-Backed</h3>
              <p className="text-slate-600">McCabe's Cyclomatic Complexity is a proven metric used by Fortune 500 companies for 40+ years</p>
            </div>
            <div className="p-8 bg-white rounded-xl border border-slate-200">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Precisely Calculated</h3>
              <p className="text-slate-600">No guessing—every test scenario is justified by the formula and documented</p>
            </div>
            <div className="p-8 bg-white rounded-xl border border-slate-200">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Insanely Fast</h3>
              <p className="text-slate-600">Go from requirement to complete test plan in minutes, not days</p>
            </div>
            <div className="p-8 bg-white rounded-xl border border-slate-200">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Stakeholder Ready</h3>
              <p className="text-slate-600">Data-driven estimates that executives and PMs actually believe</p>
            </div>
            <div className="p-8 bg-white rounded-xl border border-slate-200">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">AI-Powered</h3>
              <p className="text-slate-600">Claude AI handles requirement analysis, story generation, and scenario extraction</p>
            </div>
            <div className="p-8 bg-white rounded-xl border border-slate-200">
              <div className="text-3xl mb-3">🏢</div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">Team Collaboration</h3>
              <p className="text-slate-600">Save & share plans with your team. Every analysis is stored for future reference</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 px-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-5xl sm:text-6xl font-bold">Ready to Transform Your Testing?</h2>
          <p className="text-xl text-blue-50 leading-relaxed">
            Join QA teams using science-backed complexity analysis to justify every test and estimate accurately.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup">
              <button className="px-8 py-4 bg-white text-blue-600 rounded-lg hover:shadow-2xl font-bold text-lg transition-all transform hover:scale-105">
                Start Free Today →
              </button>
            </Link>
            <Link href="/login">
              <button className="px-8 py-4 border-2 border-white text-white rounded-lg hover:bg-white hover:bg-opacity-10 font-bold text-lg transition-all">
                Already Using It? Sign In
              </button>
            </Link>
          </div>
          <p className="text-sm text-blue-100">
            No credit card required • Free forever plan • Unlimited analyses
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-slate-600">
          <p className="font-semibold mb-2">DeliveryForge</p>
          <p className="text-sm">Transform requirements into complete delivery plans</p>
          <p className="text-xs mt-4">© 2026 DeliveryForge. Enterprise delivery planning platform.</p>
        </div>
      </footer>
    </div>
  );
}
