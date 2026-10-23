import Link from "next/link";
import { ArrowUpRight, LockKeyhole, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeProvider";
import {WorkflowIllustration} from "@/components/consultation/WorkflowIllustration";
export default function Home() {
  return (
    <div className="landing">
      <a className="skip-link" href="#story">
        Skip to content
      </a>
      <header className="record-header">
        <Link href="/" className="wordmark">
          CLINIQ<span>+</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#privacy">Your privacy</a>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <Link className="primary-button" href="/login">
            Sign in <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main id="story">
        <section className="landing-hero">
          <div>
            <p className="eyebrow">A clearer thread through your care</p>
            <h1>
              Your records,
              <br />
              connected to
              <br />
              <em>every visit.</em>
            </h1>
            <p className="hero-description">
              Keep the original. Bring the conversation into a reviewed visit.
              Carry the approved record forward.
            </p>
            <div className="hero-actions">
              <Link className="primary-button" href="/login">
                Open your workspace <ArrowRight size={18} />
              </Link>
              <Link className="text-link" href="/design/consultation">
                Explore the visual sample <ArrowUpRight size={16} />
              </Link>
            </div>
            <p className="product-boundary">
              In development · educational product · synthetic data only
            </p>
          </div>
          <WorkflowIllustration/>
        </section>
        <section id="how" className="landing-story">
          <p className="eyebrow">From one visit to the next</p>
          <div className="story-heading">
            <h2>
              Less searching.
              <br />
              More context.
            </h2>
            <p>
              A record should stay useful after the appointment ends. Start with
              a private library, then share only the documents you choose.
            </p>
          </div>
          <div className="story-columns">
            <article>
              <span className="step-number">01 / KEEP</span>
              <h3>Your history, in one place.</h3>
              <p>
                Add a supported PDF, text file or image. Original files stay
                available while processing states tell you exactly what can be
                read.
              </p>
            </article>
            <article>
              <span className="step-number">02 / READ THE SOURCE</span>
              <h3>Always close to the original.</h3>
              <p>
                Text-bearing records keep page references. Scans and unreadable
                files ask for a labelled manual transcript, without pretending
                OCR ran.
              </p>
            </article>
            <article>
              <span className="step-number">03 / SHARE DELIBERATELY</span>
              <h3>A choice for each record.</h3>
              <p>
                Explicit sharing gives an eligible clinician access. Revoke
                future access when you choose. A downloaded copy cannot be
                recalled.
              </p>
            </article>
          </div>
        </section>
        <section id="privacy" className="privacy-story">
          <LockKeyhole size={28} />
          <div>
            <p className="eyebrow">Control stays with the patient</p>
            <h2>
              Private by default.
              <br />
              Shared by choice.
            </h2>
          </div>
          <p>
            Care relationships do not open your whole library. Each document
            needs an explicit grant. This product is being built and tested with
            synthetic data; clinical workflows and hosted acceptance are still
            incomplete.
          </p>
        </section>
      </main>
      <footer className="landing-footer">
        <Link className="wordmark" href="/">
          CLINIQ<span>+</span>
        </Link>
        <p>Source-first records. Clinician review remains essential.</p>
        <a href="https://github.com/whoevenisshubham/CliniQ">
          Source & implementation status <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  );
}
