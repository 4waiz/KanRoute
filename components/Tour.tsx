"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Compass, X } from "lucide-react";

/**
 * First-run guided tour.
 *
 * A judge or a new operator lands on a dense operations board with no idea
 * which number matters or what to press. This walks them through it once,
 * spotlighting the real element each step describes rather than showing a
 * screenshot of it, so what they learn is where things actually are.
 */

const SEEN_KEY = "kanroute.tour.v1";

type Step = {
  /** Matches a data-tour attribute in the page. */
  target: string;
  title: string;
  body: string;
  /** Preferred side; the tour flips it when there is no room. */
  place?: "top" | "bottom" | "left" | "right";
};

const STEPS: Step[] = [
  {
    target: "headline",
    title: "The whole idea, in two numbers",
    body: "Today these deliveries take 132 separate vans, because four companies each book their own. Pooled into a shared fleet, the same parcels need 45. Everything else on this screen explains how.",
    place: "bottom",
  },
  {
    target: "routes",
    title: "One row is one van",
    body: "Each row is a single vehicle: how many stops it makes, what it carries, and how far it drives. The coloured chips are the companies sharing that van — three rivals in one vehicle. Tick a row to draw it on the map.",
    place: "right",
  },
  {
    target: "map",
    title: "The plan on real roads",
    body: "The white circle is the depot, white dots are suppliers, coloured diamonds are drop zones. Route lines follow the actual road network. Hover a route to see its full pickup sequence, named stop by stop.",
    place: "left",
  },
  {
    target: "fleet",
    title: "Send the vans out",
    body: "Press Dispatch fleet and the vehicles drive their routes on the map, deliver, then return to the depot. Each card tracks its stops, distance and the emissions it avoided.",
    place: "left",
  },
  {
    target: "why",
    title: "Why the AI chose this",
    body: "Devin explains the plan in its own words — which constraint was binding, and what it would take to go further. Select a route and this narrows to that vehicle's reasoning.",
    place: "top",
  },
  {
    target: "disruption",
    title: "Break it on purpose",
    body: "Close a road or take a van off the road, and the agent replans against the new constraint. The board keeps showing the last proven plan while it works.",
    place: "top",
  },
  {
    target: "live",
    title: "Live, not polled",
    body: "Every line here is a real call to Context.dev, Devin or Convex. The feed is pushed from the server the moment it happens — the browser never asks.",
    place: "top",
  },
  {
    target: "run",
    title: "Run it yourself",
    body: "This starts a fresh consolidation: Convex hands the parcels to Devin, which writes an optimiser, runs it, then writes a separate checker to prove the plan is operable.",
    place: "bottom",
  },
];

const PAD = 8;
const CARD_W = 344;

type Rect = { top: number; left: number; width: number; height: number };

export function Tour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // First visit only. Any failure reading storage just means no tour, which
  // is a better outcome than a crash on a locked-down browser.
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* private mode, blocked storage: skip silently */
    }
  }, []);

  useEffect(() => {
    const start = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("kanroute:tour", start);
    return () => window.removeEventListener("kanroute:tour", start);
  }, []);

  const step = STEPS[i];

  const measure = useCallback(() => {
    if (!open || !step) return;
    const el = document.querySelector<HTMLElement>(
      `[data-tour="${step.target}"]`,
    );
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [open, step]);

  useEffect(() => {
    measure();
    // The board reflows as panels settle and data lands, so keep the
    // spotlight attached rather than measuring once.
    const id = window.setInterval(measure, 400);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const finish = useCallback(() => {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* nothing to do */
    }
  }, []);

  const next = useCallback(() => {
    setI((n) => {
      if (n >= STEPS.length - 1) {
        finish();
        return n;
      }
      return n + 1;
    });
  }, [finish]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, next, finish]);

  const card = useMemo(() => {
    if (!rect) return null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const place = step?.place ?? "bottom";
    const est = 190;

    let top: number;
    let left: number;

    if (place === "right" && rect.left + rect.width + CARD_W + 24 < vw) {
      left = rect.left + rect.width + 16;
      top = rect.top;
    } else if (place === "left" && rect.left - CARD_W - 24 > 0) {
      left = rect.left - CARD_W - 16;
      top = rect.top;
    } else if (place === "top" && rect.top - est - 16 > 0) {
      left = rect.left + rect.width / 2 - CARD_W / 2;
      top = rect.top - est - 14;
    } else if (rect.top + rect.height + est + 16 < vh) {
      left = rect.left + rect.width / 2 - CARD_W / 2;
      top = rect.top + rect.height + 14;
    } else {
      left = rect.left + rect.width / 2 - CARD_W / 2;
      top = Math.max(16, rect.top - est - 14);
    }

    return {
      left: Math.max(14, Math.min(left, vw - CARD_W - 14)),
      top: Math.max(14, Math.min(top, vh - est - 14)),
    };
  }, [rect, step]);

  if (!mounted || !open || !step) return null;

  return createPortal(
    <div className="kr-tour" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* One element does the dimming and the cut-out: an enormous shadow
          spreading outward from the highlighted box. */}
      {rect ? (
        <div
          className="kr-tour-spot"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="kr-tour-veil" />
      )}

      <div
        className="kr-tour-card"
        style={
          card
            ? { top: card.top, left: card.left, width: CARD_W }
            : {
                top: "50%",
                left: "50%",
                width: CARD_W,
                transform: "translate(-50%, -50%)",
              }
        }
      >
        <div className="kr-tour-head">
          <span className="kr-tour-badge">
            <Compass className="h-3 w-3" />
            Guided tour
          </span>
          <button onClick={finish} className="kr-tour-x" aria-label="Skip tour">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3 className="kr-tour-title">{step.title}</h3>
        <p className="kr-tour-body">{step.body}</p>

        <div className="kr-tour-foot">
          <span className="kr-tour-dots" aria-hidden="true">
            {STEPS.map((s, n) => (
              <i key={s.target} className={n === i ? "on" : n < i ? "past" : ""} />
            ))}
          </span>

          <span className="kr-tour-actions">
            {i > 0 && (
              <button
                onClick={() => setI((n) => Math.max(0, n - 1))}
                className="kr-tour-btn"
              >
                <ArrowLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button onClick={next} className="kr-tour-btn kr-tour-btn-go">
              {i === STEPS.length - 1 ? (
                <>
                  Got it
                  <Check className="h-3 w-3" />
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Restarts the tour from anywhere. */
export function startTour() {
  window.dispatchEvent(new Event("kanroute:tour"));
}
