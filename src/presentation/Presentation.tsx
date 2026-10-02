import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Home,
  KeyRound,
  LayoutGrid,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
  BriefcaseBusiness,
} from "lucide-react";
import App from "../App";
import {
  allScenes,
  journeys,
  overviewTour,
  presentationUrl,
  readPresentationLocation,
  roleLabels,
  type DemoJourney,
} from "./journeys";
import "./presentation.css";

const icons = {
  home: Home,
  key: KeyRound,
  building: Building2,
  calendar: CalendarDays,
  service: Wrench,
  work: BriefcaseBusiness,
  shield: ShieldCheck,
  user: UserRound,
};
const githubUrl =
  "https://github.com/Genovesi-JM/Kasa/tree/presentation-prototype";

export default function Presentation() {
  const [location, setLocation] = useState(() =>
    readPresentationLocation(window.location.search),
  );
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState("All journeys");
  const [run, setRun] = useState(0);
  const [guideOpen, setGuideOpen] = useState(
    () => !window.matchMedia("(max-height: 600px)").matches,
  );
  const [copyState, setCopyState] = useState<{
    message: string;
    sequence: number;
  } | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const toolbar = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const shareInput = useRef<HTMLInputElement>(null);
  const statusTrigger = useRef<HTMLButtonElement | null>(null);
  const statusSequence = useRef(0);
  const { journey, step, finished } = location;
  const scene = journey?.scenes[step];
  const active = Boolean(scene && !finished);

  useEffect(() => {
    const onPopState = () => {
      setLocation(readPresentationLocation(window.location.search));
      setCopyState(null);
      setShareUrl("");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!toolbar.current) return;
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty(
        "--presentation-height",
        `${entry.target.getBoundingClientRect().height}px`,
      );
    });
    observer.observe(toolbar.current);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--presentation-height");
    };
  }, [active]);

  useEffect(() => {
    document.title =
      scene && !finished
        ? `${scene.title} · Kasa prototype`
        : "Kasa · Interactive prototype";
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.current?.focus({ preventScroll: true });
  }, [scene, finished, location, run]);

  useEffect(() => {
    if (shareUrl) shareInput.current?.focus();
  }, [shareUrl]);

  function announce(message: string) {
    statusSequence.current += 1;
    setCopyState({ message, sequence: statusSequence.current });
  }

  function navigate(next?: DemoJourney, nextStep = 0, done = false) {
    window.history.pushState(null, "", presentationUrl(next, nextStep, done));
    setLocation(readPresentationLocation(window.location.search));
    setShareUrl("");
    setCopyState(null);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareUrl("");
      announce("Link copied. Ready to share.");
    } catch {
      setShareUrl(window.location.href);
      announce("Copy the selected link below to share this prototype.");
      shareInput.current?.focus();
      shareInput.current?.select();
    }
  }

  const visible = journeys.filter((item) => {
    const matchesAudience =
      audience === "All journeys" || item.audience === audience;
    const searchText =
      `${item.title} ${item.description} ${item.scenes.map((s) => `${s.title} ${s.detail}`).join(" ")}`.toLowerCase();
    return matchesAudience && searchText.includes(query.trim().toLowerCase());
  });

  return (
    <div className={`presentation ${active ? "presentation-active" : ""}`}>
      <a className="presentation-skip-link" href="#presentation-content">
        Skip prototype controls
      </a>
      <header
        className="presentation-toolbar"
        ref={toolbar}
        aria-label="Prototype controls"
      >
        <div className="presentation-topline">
          <button
            className="presentation-brand"
            onClick={() => navigate()}
            aria-label="Kasa prototype navigator"
          >
            <span>
              <Home size={19} />
            </span>
            Kasa <small>PROTOTYPE</small>
          </button>
          <div className="presentation-tools">
            {active && (
              <button
                onClick={() => navigate()}
                aria-label="Open prototype navigator"
              >
                <LayoutGrid size={17} />
                <span>Navigator</span>
              </button>
            )}
            {active && (
              <button
                onClick={(event) => {
                  statusTrigger.current = event.currentTarget;
                  setRun((value) => value + 1);
                  setShareUrl("");
                  announce("Scene reset to sample data.");
                }}
                title="Reset this scene to sample data"
                aria-label="Reset this scene to sample data"
              >
                <RotateCcw size={17} />
                <span>Reset scene</span>
              </button>
            )}
            <button
              onClick={(event) => {
                statusTrigger.current = event.currentTarget;
                void copyLink();
              }}
              aria-label="Copy prototype link"
            >
              <Copy size={17} />
              <span>Copy link</span>
            </button>
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="View source on GitHub (opens in new tab)"
            >
              <span>GitHub</span>
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
        {active && journey && scene && (
          <>
            <div className="presentation-scene-bar">
              <div className="presentation-scene-title">
                <span className="presentation-count" aria-hidden="true">
                  {step + 1}
                  <span> / {journey.scenes.length}</span>
                </span>
                <div>
                  <small>{journey.title}</small>
                  <h1
                    tabIndex={-1}
                    ref={heading}
                    aria-describedby="presentation-scene-context"
                  >
                    {scene.title}
                  </h1>
                  <span
                    id="presentation-scene-context"
                    className="presentation-sr-only"
                  >
                    Scene {step + 1} of {journey.scenes.length} in{" "}
                    {journey.title}.
                  </span>
                </div>
              </div>
              <div className="presentation-step-controls">
                <button
                  disabled={step === 0}
                  onClick={() => navigate(journey, step - 1)}
                  aria-label={
                    step > 0
                      ? `Previous scene: ${journey.scenes[step - 1].title}`
                      : "Previous scene"
                  }
                >
                  <ArrowLeft size={18} />
                </button>
                <button
                  className="presentation-next"
                  aria-label={
                    step < journey.scenes.length - 1
                      ? `Next scene: ${journey.scenes[step + 1].title}`
                      : "Finish this journey"
                  }
                  onClick={() =>
                    step < journey.scenes.length - 1
                      ? navigate(journey, step + 1)
                      : navigate(journey, step, true)
                  }
                >
                  {step < journey.scenes.length - 1 ? "Next" : "Finish"}
                  <ArrowRight size={17} />
                </button>
                <button
                  onClick={() => setGuideOpen((value) => !value)}
                  aria-expanded={guideOpen}
                  aria-controls="presentation-guide"
                  aria-label={
                    guideOpen
                      ? "Hide presentation notes"
                      : "Show presentation notes"
                  }
                >
                  {guideOpen ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
              </div>
            </div>
            <div
              className="presentation-guide"
              id="presentation-guide"
              hidden={!guideOpen}
            >
              <p>
                <strong>Try it</strong>
                {scene.tryIt}
              </p>
              <span>{roleLabels[scene.target.role]} · Sample data</span>
            </div>
            <div
              className="presentation-progress"
              role="progressbar"
              aria-label="Tour position"
              aria-valuemin={1}
              aria-valuemax={journey.scenes.length}
              aria-valuenow={step + 1}
              aria-valuetext={`Scene ${step + 1} of ${journey.scenes.length}: ${scene.title}`}
            >
              <span
                style={{
                  width: `${((step + 1) / journey.scenes.length) * 100}%`,
                }}
              />
            </div>
          </>
        )}
        <div
          className={
            copyState ? "presentation-copy-status" : "presentation-sr-only"
          }
        >
          <span role="status" aria-live="polite" aria-atomic="true">
            {copyState && (
              <span key={copyState.sequence}>{copyState.message}</span>
            )}
          </span>
          {copyState && (
            <button
              onClick={() => {
                setCopyState(null);
                setShareUrl("");
                statusTrigger.current?.focus();
              }}
              aria-label="Dismiss status message"
            >
              ×
            </button>
          )}
        </div>
        {shareUrl && (
          <input
            className="presentation-share-input"
            ref={shareInput}
            aria-label="Prototype link"
            readOnly
            value={shareUrl}
            onFocus={(event) => event.target.select()}
          />
        )}
      </header>

      {active && scene ? (
        <div
          className="presentation-stage"
          id="presentation-content"
          tabIndex={-1}
          role="region"
          aria-label="Interactive prototype"
        >
          <App
            key={`${journey!.id}-${scene.id}-${run}`}
            demoTarget={scene.target}
          />
        </div>
      ) : finished && journey ? (
        <main
          className="presentation-complete"
          id="presentation-content"
          tabIndex={-1}
        >
          <span className="presentation-complete-icon">
            <Check size={28} />
          </span>
          <p className="presentation-eyebrow">TOUR COMPLETE</p>
          <h1 ref={heading} tabIndex={-1}>
            You've explored{" "}
            {journey.title === overviewTour.title
              ? "Kasa"
              : journey.title.toLowerCase()}
            .
          </h1>
          <p>
            Keep exploring any journey, or restart with fresh sample data for
            your next presentation.
          </p>
          <div className="presentation-complete-actions">
            <button className="presentation-primary" onClick={() => navigate()}>
              <LayoutGrid size={18} />
              Explore all journeys
            </button>
            <button
              className="presentation-secondary"
              onClick={() => {
                setRun((value) => value + 1);
                navigate(journey);
              }}
            >
              <RotateCcw size={17} />
              Restart tour
            </button>
          </div>
          <div className="presentation-scope-note">
            <strong>An interactive product prototype</strong>
            <p>
              Actions use sample records. Authentication, saved production data,
              real messaging, verification and payment providers still need
              integration. Kasa does not collect rent or act as a property
              broker.
            </p>
          </div>
        </main>
      ) : (
        <main
          className="presentation-hub"
          id="presentation-content"
          tabIndex={-1}
        >
          <section className="presentation-intro">
            <div>
              <p className="presentation-eyebrow">
                THE INTERACTIVE KASA PROTOTYPE
              </p>
              <h1 ref={heading} tabIndex={-1}>
                One Kasa.
                <br />
                Every journey, connected.
              </h1>
              <p>
                Find a home. Run your property business. Connect with local
                help, work and spaces.
              </p>
              <div className="presentation-start">
                <button
                  className="presentation-primary"
                  onClick={() => navigate(overviewTour)}
                >
                  <Play size={18} />
                  Start the product tour
                  <ArrowRight size={18} />
                </button>
                <span>
                  About 7 minutes · {overviewTour.scenes.length} stops
                </span>
              </div>
            </div>
            <div
              className="presentation-overview"
              aria-label="Prototype overview"
            >
              <div>
                <strong>{journeys.length}</strong>
                <span>guided journeys</span>
              </div>
              <div>
                <strong>{allScenes.length}</strong>
                <span>screen entry points</span>
              </div>
              <p>
                Click through the real interface.
                <br />
                No account setup needed.
              </p>
              <span className="presentation-sample">
                Interactive prototype · Sample data
              </span>
            </div>
          </section>

          <section
            className="presentation-navigation"
            aria-labelledby="journeys-title"
          >
            <div className="presentation-section-heading">
              <div>
                <p className="presentation-eyebrow">EXPLORE AT YOUR OWN PACE</p>
                <h2 id="journeys-title">Choose a journey</h2>
              </div>
              <label className="presentation-search">
                <Search size={18} />
                <input
                  type="search"
                  ref={searchInput}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a feature or workflow"
                  aria-label="Find a feature or workflow"
                />
              </label>
            </div>
            <div
              className="presentation-filters"
              role="group"
              aria-label="Filter journeys by audience"
            >
              {["All journeys", "Personal", "Professional", "Platform"].map(
                (item) => (
                  <button
                    key={item}
                    aria-pressed={audience === item}
                    onClick={() => setAudience(item)}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
            <p
              className="presentation-results-count"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {visible.length} {visible.length === 1 ? "journey" : "journeys"}
              {audience !== "All journeys" && ` for ${audience.toLowerCase()}`}
              {query.trim() && ` matching “${query.trim()}”`}
            </p>
            <div className="presentation-grid">
              {visible.map((item) => {
                const Icon = icons[item.icon];
                return (
                  <article className="presentation-card" key={item.id}>
                    <div className="presentation-card-heading">
                      <span className="presentation-card-icon">
                        <Icon size={23} />
                      </span>
                      <span>{item.audience}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    {item.phase && (
                      <span className="presentation-phase">{item.phase}</span>
                    )}
                    <button
                      className="presentation-card-start"
                      aria-label={`Explore journey: ${item.title}, ${item.scenes.length} ${item.scenes.length === 1 ? "stop" : "stops"}`}
                      onClick={() => navigate(item)}
                    >
                      Explore journey{" "}
                      <span>
                        {item.scenes.length}{" "}
                        {item.scenes.length === 1 ? "stop" : "stops"}
                        <ArrowRight size={17} />
                      </span>
                    </button>
                    <details>
                      <summary>
                        Jump to a screen
                        <span className="presentation-sr-only">
                          {" "}
                          in {item.title}
                        </span>
                      </summary>
                      <ol>
                        {item.scenes.map((entry, index) => (
                          <li key={entry.id}>
                            <button
                              onClick={() => navigate(item, index)}
                              aria-label={`${entry.title}, scene ${index + 1} of ${item.scenes.length} in ${item.title}`}
                            >
                              {entry.title}
                              <ArrowRight size={15} />
                            </button>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </article>
                );
              })}
            </div>
            {visible.length === 0 && (
              <div className="presentation-empty">
                <Search size={28} />
                <h3>No journeys match that search</h3>
                <p>Try “rent”, “work”, “maintenance” or another feature.</p>
                <button
                  className="presentation-secondary"
                  onClick={() => {
                    setQuery("");
                    setAudience("All journeys");
                    searchInput.current?.focus();
                  }}
                >
                  Show all journeys
                </button>
              </div>
            )}
          </section>

          <section
            className="presentation-readiness"
            aria-labelledby="prototype-scope"
          >
            <div>
              <p className="presentation-eyebrow">PRESENT WITH CONFIDENCE</p>
              <h2 id="prototype-scope">What this prototype demonstrates</h2>
              <p>
                Navigation and product workflows across five workspaces. Example
                names, listings, amounts and verification badges are synthetic.
              </p>
            </div>
            <ul>
              <li>
                <Check size={18} />
                <span>
                  <strong>Interactive today</strong>Search, filters, screen
                  navigation, calculators, forms and sample workflow actions.
                </span>
              </li>
              <li>
                <Wrench size={18} />
                <span>
                  <strong>Simulated in the prototype</strong>Applications, chat,
                  rent records, bookings, moderation and other records reset
                  when a scene restarts.
                </span>
              </li>
              <li>
                <CalendarDays size={18} />
                <span>
                  <strong>Before launch</strong>Production accounts, database,
                  private files, notifications, verification and payment
                  integrations. Spaces is Phase 2.
                </span>
              </li>
            </ul>
          </section>
          <footer className="presentation-footer">
            <span>
              Kasa · Properties, operations, services, work and spaces.
            </span>
            <span>
              Rent goes directly to the landlord. No property brokerage.
            </span>
            <a href="?app=1">
              Open the original app experience <ArrowRight size={15} />
            </a>
          </footer>
        </main>
      )}
    </div>
  );
}
