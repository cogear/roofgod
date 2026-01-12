import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LandingPage() {
  return (
    <>
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">RoofGod</span>
            <Badge variant="secondary">Beta</Badge>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Admin Login
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="py-20 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              The Invisible Foreman
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8">
              AI-powered back-office assistant that lives in your WhatsApp.
              No apps to download. No dashboards to check. Just message your assistant.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="text-lg px-8">
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Watch Demo
              </Button>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-20 bg-muted/50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">1</span>
                    Sign Up
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    Create your account and add your team. We&apos;ll send you a WhatsApp link to connect with your AI assistant.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">2</span>
                    Connect
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    Link your email so your assistant can watch for permits, quotes, and invoices. It files everything automatically.
                  </CardDescription>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">3</span>
                    Work
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    Just message your assistant. &quot;Create a project for 123 Oak St&quot; or &quot;Did that permit come in?&quot; It handles the rest.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Built for Roofers
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl">📱</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">WhatsApp Native</h3>
                  <p className="text-muted-foreground">
                    Your crews already use WhatsApp. No new apps to learn. Just text your assistant like you&apos;d text anyone else.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl">📧</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Email Bridge</h3>
                  <p className="text-muted-foreground">
                    Connect your Gmail or Outlook. Your assistant reads permits, quotes, and invoices, then files them automatically.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl">📋</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Smart Filing</h3>
                  <p className="text-muted-foreground">
                    Send a photo of a receipt, your assistant reads it and files it to the right project. &quot;Find the permit for Oak St&quot; actually works.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl">👥</span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Crew Mode</h3>
                  <p className="text-muted-foreground">
                    Your assistant knows who&apos;s who. Managers get detailed reports. Crews get quick, actionable updates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to hire your AI foreman?
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Join the roofing contractors who&apos;ve replaced their paper mess with a WhatsApp conversation.
            </p>
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Start Free Trial
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} RoofGod. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
