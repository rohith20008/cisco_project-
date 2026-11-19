import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  FileSearch,
  ShieldCheck,
  Brain,
  Users,
  RefreshCw,
  ChevronRight,
  Terminal,
  Wrench,
  Target,
  Layers,
  MessageSquare,
  XCircle,
  Pencil,
  ArrowLeft,
} from "lucide-react";

import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");

  const [cases, setCases] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [loadingCases, setLoadingCases] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const [selectedCase, setSelectedCase] = useState(null);

  const [diagnosis, setDiagnosis] = useState(null);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [diagnosisError, setDiagnosisError] = useState("");

  const [editedRootCause, setEditedRootCause] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");

  // =====================================================
  // LOAD CASES
  // =====================================================

  const loadCases = async () => {
    setLoadingCases(true);

    try {
      const response = await fetch(`${API_URL}/cases`);

      if (!response.ok) {
        throw new Error("Failed to load cases");
      }

      const data = await response.json();

      setCases(data.cases || []);
    } catch (error) {
      console.error("Cases error:", error);
    } finally {
      setLoadingCases(false);
    }
  };

  // =====================================================
  // LOAD REVIEWS
  // =====================================================

  const loadReviews = async () => {
    setLoadingReviews(true);

    try {
      const response = await fetch(`${API_URL}/reviews`);

      if (!response.ok) {
        throw new Error("Failed to load reviews");
      }

      const data = await response.json();

      setReviews(data.reviews || []);
    } catch (error) {
      console.error("Reviews error:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

  // =====================================================
  // INITIAL DATA
  // =====================================================

  useEffect(() => {
    loadCases();
    loadReviews();
  }, []);

  // =====================================================
  // NAVIGATION
  // =====================================================

  const navigateTo = (page) => {
    setActivePage(page);

    // Close case modal whenever navigation happens.
    setSelectedCase(null);

    // Always start the new page at the top.
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =====================================================
  // AI DIAGNOSIS
  // =====================================================

  const runDiagnosis = async (caseCode) => {
    if (!caseCode) {
      setDiagnosisError("No case was selected.");
      setDiagnosisLoading(false);
      navigateTo("AI Diagnosis");
      return;
    }

    /*
     * IMPORTANT:
     * Navigate IMMEDIATELY.
     *
     * Previously this happened only after the API response.
     * That made the interface look stuck after clicking
     * "Diagnose This Case".
     */
    setActivePage("AI Diagnosis");
    setSelectedCase(null);
    setDiagnosis(null);
    setDiagnosisError("");
    setReviewMessage("");
    setEditedRootCause("");
    setReviewComment("");
    setDiagnosisLoading(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    try {
      const response = await fetch(`${API_URL}/diagnose/${caseCode}`);

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        let message = "AI diagnosis failed.";

        if (typeof data?.detail === "string") {
          message = data.detail;
        } else if (data?.detail?.message) {
          message = data.detail.message;
        }

        throw new Error(message);
      }

      setDiagnosis(data);

      setEditedRootCause(
        data?.ai_diagnosis?.root_cause || ""
      );

      setReviewComment("");
    } catch (error) {
      console.error("Diagnosis error:", error);

      setDiagnosisError(
        error?.message || "Unable to generate diagnosis."
      );
    } finally {
      setDiagnosisLoading(false);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  // =====================================================
  // HUMAN REVIEW
  // =====================================================

  const submitReview = async (decision) => {
    if (!diagnosis) {
      return;
    }

    if (
      decision === "Edited" &&
      !editedRootCause.trim()
    ) {
      setReviewMessage(
        "Please enter the corrected root cause."
      );

      return;
    }

    setReviewSubmitting(true);
    setReviewMessage("");

    const ai = diagnosis.ai_diagnosis;
    const caseData = diagnosis.case;

    const finalRootCause =
      decision === "Edited"
        ? editedRootCause.trim()
        : ai?.root_cause || "";

    const correctedFields =
      decision === "Edited"
        ? {
            root_cause: {
              original: ai?.root_cause || "",
              corrected: editedRootCause.trim(),
            },
          }
        : {};

    const reviewData = {
      case_id: caseData.case_code,
      decision,
      final_root_cause: finalRootCause,
      reviewer_comment: reviewComment.trim(),
      corrected_fields: correctedFields,
    };

    try {
      const response = await fetch(
        `${API_URL}/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reviewData),
        }
      );

      let data = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Failed to save review."
        );
      }

      setReviewMessage(
        `Review saved successfully as "${decision}".`
      );

      await loadReviews();
    } catch (error) {
      console.error("Review error:", error);

      setReviewMessage(
        `Review failed: ${
          error?.message || "Unknown error"
        }`
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  // =====================================================
  // MENU
  // =====================================================

  const menuItems = [
    {
      name: "Dashboard",
      icon: Activity,
    },
    {
      name: "Cases",
      icon: FileSearch,
    },
    {
      name: "AI Diagnosis",
      icon: Brain,
    },
    {
      name: "Reviews",
      icon: Users,
    },
  ];

  // =====================================================
  // DASHBOARD
  // =====================================================

  const Dashboard = () => {
    return (
      <section className="content page-full">
        <div className="welcome">
          <div>
            <h3>Welcome to AFFI'S AI</h3>

            <p>
              Analyze network incidents using deterministic
              rules and AI-assisted diagnosis.
            </p>
          </div>

          <div className="ai-badge">
            <Brain size={20} />
            Local AI
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">
              <FileSearch size={24} />
            </div>

            <div>
              <span>Total Cases</span>
              <strong>{cases.length}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange">
              <AlertTriangle size={24} />
            </div>

            <div>
              <span>Cases Loaded</span>
              <strong>{cases.length}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">
              <Brain size={24} />
            </div>

            <div>
              <span>AI Diagnoses</span>
              <strong>{diagnosis ? 1 : 0}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">
              <CheckCircle size={24} />
            </div>

            <div>
              <span>Human Reviews</span>
              <strong>{reviews.length}</strong>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Quick Actions</h3>
                <p>Start troubleshooting a case</p>
              </div>
            </div>

            <div className="quick-actions">
              <button
                className="action-card"
                onClick={() => navigateTo("Cases")}
              >
                <FileSearch size={26} />

                <div>
                  <strong>Browse Cases</strong>

                  <span>
                    View available network incidents
                  </span>
                </div>
              </button>

              <button
                className="action-card"
                onClick={() => navigateTo("AI Diagnosis")}
              >
                <Brain size={26} />

                <div>
                  <strong>AI Diagnosis</strong>

                  <span>
                    Analyze a network case
                  </span>
                </div>
              </button>

              <button
                className="action-card"
                onClick={() => navigateTo("Reviews")}
              >
                <Users size={26} />

                <div>
                  <strong>Human Review</strong>

                  <span>
                    Review AI recommendations
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>System Status</h3>

                <p>
                  Current AFFI'S AI components
                </p>
              </div>
            </div>

            <div className="system-list">
              <div className="system-row">
                <div>
                  <strong>
                    FastAPI Backend
                  </strong>

                  <span>
                    127.0.0.1:8000
                  </span>
                </div>

                <span className="online">
                  Online
                </span>
              </div>

              <div className="system-row">
                <div>
                  <strong>
                    Rule Checker
                  </strong>

                  <span>
                    Python deterministic engine
                  </span>
                </div>

                <span className="online">
                  Ready
                </span>
              </div>

              <div className="system-row">
                <div>
                  <strong>
                    Ollama
                  </strong>

                  <span>
                    Qwen 2.5 7B
                  </span>
                </div>

                <span className="online">
                  Ready
                </span>
              </div>

              <div className="system-row">
                <div>
                  <strong>
                    Human Review
                  </strong>

                  <span>
                    Review workflow
                  </span>
                </div>

                <span className="online">
                  Enabled
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="responsible-ai">
          <div className="responsible-icon">
            <ShieldCheck size={24} />
          </div>

          <div>
            <h3>Responsible AI</h3>

            <p>
              AI recommendations are advisory only.
              Every diagnosis requires human review before
              it is treated as final.
            </p>
          </div>
        </div>
      </section>
    );
  };

  // =====================================================
  // CASES PAGE
  // =====================================================

  const CasesPage = () => {
    return (
      <section className="content page-full">
        <div className="page-heading">
          <div>
            <h3>Network Cases</h3>

            <p>
              Select a case to inspect the network incident.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={loadCases}
            disabled={loadingCases}
          >
            <RefreshCw
              size={16}
              className={
                loadingCases
                  ? "spin"
                  : ""
              }
            />

            {loadingCases ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingCases ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Loading cases...</span>
          </div>
        ) : cases.length === 0 ? (
          <div className="empty-page">
            <FileSearch size={48} />

            <h3>No cases found</h3>

            <p>
              Make sure the FastAPI backend is running.
            </p>

            <button
              className="diagnose-button"
              onClick={loadCases}
            >
              <RefreshCw size={18} />
              Try Again
            </button>
          </div>
        ) : (
          <div className="cases-grid">
            {cases.map((item) => (
              <button
                key={item.case_code}
                className="case-card"
                onClick={() =>
                  setSelectedCase(item)
                }
              >
                <div className="case-top">
                  <span className="case-code">
                    {item.case_code}
                  </span>

                  <span className="case-severity">
                    {item.severity}
                  </span>
                </div>

                <h3>{item.concept}</h3>

                <p>{item.symptom}</p>

                <div className="case-bottom">
                  <span>
                    {item.osi_layer}
                  </span>

                  <ChevronRight size={18} />
                </div>
              </button>
            ))}
          </div>
        )}

        {/* CASE MODAL */}

        {selectedCase && (
          <div
            className="modal-overlay"
            onClick={(event) => {
              if (
                event.target === event.currentTarget
              ) {
                setSelectedCase(null);
              }
            }}
          >
            <div className="case-modal">
              <button
                className="close-button"
                onClick={() =>
                  setSelectedCase(null)
                }
                aria-label="Close"
              >
                ×
              </button>

              <div className="case-modal-header">
                <span className="case-code">
                  {selectedCase.case_code}
                </span>

                <span className="case-severity">
                  {selectedCase.severity}
                </span>
              </div>

              <h2>
                {selectedCase.concept}
              </h2>

              <div className="detail-section">
                <h4>Symptom</h4>

                <p>
                  {selectedCase.symptom}
                </p>
              </div>

              <div className="detail-section">
                <h4>Topology</h4>

                <p>
                  {selectedCase.topology_note}
                </p>
              </div>

              <div className="detail-section">
                <h4>Cisco Show Output</h4>

                <pre>
                  {selectedCase.show_outputs}
                </pre>
              </div>

              <div className="detail-section">
                <h4>Expected Fault</h4>

                <p>
                  {selectedCase.expected_fault}
                </p>
              </div>

              <div className="case-meta">
                <span>
                  OSI Layer:{" "}
                  {selectedCase.osi_layer}
                </span>

                <span>
                  Concept:{" "}
                  {selectedCase.concept}
                </span>
              </div>

              {/* IMPORTANT:
                  Diagnose button now immediately switches
                  to AI Diagnosis and displays loading state.
              */}

              <button
                className="diagnose-button"
                onClick={() =>
                  runDiagnosis(
                    selectedCase.case_code
                  )
                }
              >
                <Brain size={18} />

                Diagnose This Case
              </button>
            </div>
          </div>
        )}
      </section>
    );
  };

  // =====================================================
  // AI DIAGNOSIS PAGE
  // =====================================================

  const DiagnosisPage = () => {
    // ---------------------------------------------------
    // LOADING
    // ---------------------------------------------------

    if (diagnosisLoading) {
      return (
        <section className="content page-full">
          <div className="ai-loading">
            <div className="ai-loading-icon">
              <Brain size={38} />
            </div>

            <h3>
              AFFI'S AI is analyzing the case
            </h3>

            <p>
              Running rule checks and asking Qwen 2.5
              for an evidence-based diagnosis.
            </p>

            <div className="loading-bar">
              <div className="loading-progress"></div>
            </div>

            <span>
              This may take a little while on a local model.
            </span>
          </div>
        </section>
      );
    }

    // ---------------------------------------------------
    // ERROR
    // ---------------------------------------------------

    if (diagnosisError) {
      return (
        <section className="content page-full">
          <div className="error-panel">
            <AlertTriangle size={42} />

            <h3>Diagnosis failed</h3>

            <p>{diagnosisError}</p>

            <div className="error-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  navigateTo("Cases")
                }
              >
                <ArrowLeft size={18} />
                Back to Cases
              </button>
            </div>
          </div>
        </section>
      );
    }

    // ---------------------------------------------------
    // NO DIAGNOSIS
    // ---------------------------------------------------

    if (!diagnosis) {
      return (
        <section className="content page-full">
          <div className="page-heading">
            <div>
              <h3>AI Diagnosis</h3>

              <p>
                Use the local Qwen model to analyze
                a network case.
              </p>
            </div>
          </div>

          <div className="diagnosis-placeholder">
            <Brain size={50} />

            <h3>
              Select a case to begin
            </h3>

            <p>
              Go to Cases and choose a network incident.
            </p>

            <button
              className="diagnose-button"
              onClick={() =>
                navigateTo("Cases")
              }
            >
              <FileSearch size={18} />
              Browse Cases
            </button>
          </div>
        </section>
      );
    }

    // ---------------------------------------------------
    // DIAGNOSIS RESULT
    // ---------------------------------------------------

    const ai = diagnosis.ai_diagnosis;
    const caseData = diagnosis.case;
    const rules = diagnosis.rule_checker;

    return (
      <section className="content page-full">
        <div className="page-heading">
          <div>
            <div className="diagnosis-title">
              <span className="case-code">
                {caseData.case_code}
              </span>

              <h3>AI Diagnosis</h3>
            </div>

            <p>
              Evidence-based analysis generated by Qwen 2.5.
            </p>
          </div>

          <div className="diagnosis-header-actions">
            <button
              className="secondary-button"
              onClick={() =>
                navigateTo("Cases")
              }
            >
              <ArrowLeft size={16} />
              Cases
            </button>

            <button
              className="refresh-button"
              onClick={() =>
                runDiagnosis(
                  caseData.case_code
                )
              }
            >
              <RefreshCw size={16} />
              Run Again
            </button>
          </div>
        </div>

        {/* ROOT CAUSE */}

        <div className="root-cause-card">
          <div className="root-cause-icon">
            <Target size={28} />
          </div>

          <div>
            <span>
              MOST LIKELY ROOT CAUSE
            </span>

            <h2>
              {ai?.root_cause ||
                "Not provided"}
            </h2>
          </div>
        </div>

        {/* STATS */}

        <div className="diagnosis-stats">
          <div className="diagnosis-stat">
            <div className="stat-icon purple">
              <Brain size={21} />
            </div>

            <div>
              <span>Confidence</span>

              <strong>
                {ai?.confidence ?? "—"}%
              </strong>
            </div>
          </div>

          <div className="diagnosis-stat">
            <div className="stat-icon blue">
              <Layers size={21} />
            </div>

            <div>
              <span>OSI Layer</span>

              <strong>
                {ai?.osi_layer || "—"}
              </strong>
            </div>
          </div>

          <div className="diagnosis-stat">
            <div className="stat-icon orange">
              <AlertTriangle size={21} />
            </div>

            <div>
              <span>Failed Rules</span>

              <strong>
                {rules?.failed_rules ?? 0}
              </strong>
            </div>
          </div>

          <div className="diagnosis-stat">
            <div className="stat-icon green">
              <ShieldCheck size={21} />
            </div>

            <div>
              <span>Human Review</span>

              <strong>Required</strong>
            </div>
          </div>
        </div>

        {/* EVIDENCE + COMMAND */}

        <div className="diagnosis-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Evidence</h3>

                <p>
                  Information supporting the diagnosis
                </p>
              </div>

              <MessageSquare size={20} />
            </div>

            <div className="evidence-list">
              {Array.isArray(ai?.evidence) ? (
                ai.evidence.map(
                  (evidence, index) => (
                    <div
                      className="evidence-item"
                      key={index}
                    >
                      <CheckCircle size={17} />

                      <span>
                        {evidence}
                      </span>
                    </div>
                  )
                )
              ) : (
                <div className="evidence-item">
                  <CheckCircle size={17} />

                  <span>
                    {ai?.evidence ||
                      "No evidence provided."}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>
                  Next Troubleshooting Command
                </h3>

                <p>
                  Suggested Cisco command
                </p>
              </div>

              <Terminal size={20} />
            </div>

            <pre className="command-box">
              {ai?.next_command ||
                "No command provided."}
            </pre>
          </div>
        </div>

        {/* FIX STEPS */}

        <div className="panel fix-panel">
          <div className="panel-header">
            <div>
              <h3>
                Recommended Fix Steps
              </h3>

              <p>
                Practical actions suggested by the AI
              </p>
            </div>

            <Wrench size={20} />
          </div>

          <div className="fix-list">
            {Array.isArray(ai?.fix_steps) ? (
              ai.fix_steps.map(
                (step, index) => (
                  <div
                    className="fix-item"
                    key={index}
                  >
                    <span>{index + 1}</span>

                    <p>{step}</p>
                  </div>
                )
              )
            ) : (
              <div className="fix-item">
                <span>1</span>

                <p>
                  {ai?.fix_steps ||
                    "No fix steps provided."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ORIGINAL CASE */}

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Case Evidence</h3>

              <p>
                Original information supplied to the AI
              </p>
            </div>
          </div>

          <div className="original-case">
            <div>
              <strong>Symptom</strong>

              <p>
                {caseData.symptom}
              </p>
            </div>

            <div>
              <strong>Topology</strong>

              <p>
                {caseData.topology_note}
              </p>
            </div>

            <div>
              <strong>Cisco Output</strong>

              <pre>
                {caseData.show_outputs}
              </pre>
            </div>
          </div>
        </div>

        {/* HUMAN REVIEW */}

        <div className="review-workspace">
          <div className="review-header">
            <div>
              <div className="review-title">
                <ShieldCheck size={22} />

                <h3>Human Review</h3>
              </div>

              <p>
                Verify the AI recommendation before
                accepting it as the final diagnosis.
              </p>
            </div>
          </div>

          <div className="review-form">
            <label>
              Final Root Cause
            </label>

            <div className="edit-input-wrapper">
              <Pencil size={16} />

              <input
                value={editedRootCause}
                onChange={(event) =>
                  setEditedRootCause(
                    event.target.value
                  )
                }
              />
            </div>

            <label>
              Reviewer Comment
            </label>

            <textarea
              value={reviewComment}
              onChange={(event) =>
                setReviewComment(
                  event.target.value
                )
              }
              placeholder="Add your review comments..."
              rows="4"
            />

            <div className="review-actions">
              <button
                className="accept-button"
                disabled={reviewSubmitting}
                onClick={() =>
                  submitReview("Accepted")
                }
              >
                <CheckCircle size={17} />
                Accept
              </button>

              <button
                className="edit-button"
                disabled={reviewSubmitting}
                onClick={() =>
                  submitReview("Edited")
                }
              >
                <Pencil size={17} />
                Save Edited
              </button>

              <button
                className="reject-button"
                disabled={reviewSubmitting}
                onClick={() =>
                  submitReview("Rejected")
                }
              >
                <XCircle size={17} />
                Reject
              </button>
            </div>

            {reviewSubmitting && (
              <div className="review-saving">
                Saving human review...
              </div>
            )}

            {reviewMessage && (
              <div
                className={
                  reviewMessage.startsWith(
                    "Review saved"
                  )
                    ? "review-success"
                    : "review-error"
                }
              >
                {reviewMessage}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  // =====================================================
  // REVIEWS PAGE
  // =====================================================

  const ReviewsPage = () => {
    return (
      <section className="content page-full">
        <div className="page-heading">
          <div>
            <h3>Human Reviews</h3>

            <p>
              Review history from the NetSage system.
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={loadReviews}
            disabled={loadingReviews}
          >
            <RefreshCw
              size={16}
              className={
                loadingReviews
                  ? "spin"
                  : ""
              }
            />

            {loadingReviews
              ? "Refreshing..."
              : "Refresh"}
          </button>
        </div>

        {loadingReviews ? (
          <div className="loading">
            <div className="loading-spinner"></div>
            <span>Loading reviews...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="empty-page">
            <Users size={48} />

            <h3>No reviews yet</h3>

            <p>
              Human review decisions will appear here.
            </p>
          </div>
        ) : (
          <div className="reviews-list">
            {reviews.map((review) => (
              <div
                className="review-card"
                key={review.review_id}
              >
                <div>
                  <span className="case-code">
                    {review.case_id}
                  </span>

                  <h3>
                    {review.final_root_cause}
                  </h3>

                  <p>
                    {review.reviewer_comment ||
                      "No reviewer comment."}
                  </p>
                </div>

                <div className="review-right">
                  <span className="review-decision">
                    {review.decision}
                  </span>

                  <span className="review-date">
                    {review.reviewed_at}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  // =====================================================
  // MAIN UI
  // =====================================================

  return (
    <div
      className="app"
      style={{
        minHeight: "100vh",
        width: "100%",
      }}
    >
      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">
            A
          </div>

          <div>
            <h1> AFFI'S AI</h1>

            <span>
              Intelligent Network Troubleshooting
            </span>
          </div>
        </div>

        <nav className="navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={
                  activePage === item.name
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  navigateTo(item.name)
                }
              >
                <Icon size={20} />

                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <div className="status-dot"></div>

            <div>
              <strong>
                System Online
              </strong>

              <span>
                AI Engine Ready
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}

      <main
        className="main"
        style={{
          minHeight: "100vh",
          width: "100%",
          flex: 1,
        }}
      >
        <header className="topbar">
          <div>
            <h2>{activePage}</h2>

            <p>
              AI-assisted Cisco network troubleshooting
            </p>
          </div>

          <div className="header-badge">
            <ShieldCheck size={18} />

            Human-in-the-loop
          </div>
        </header>

        {activePage === "Dashboard" && (
          <Dashboard />
        )}

        {activePage === "Cases" && (
          <CasesPage />
        )}

        {activePage === "AI Diagnosis" && (
          <DiagnosisPage />
        )}

        {activePage === "Reviews" && (
          <ReviewsPage />
        )}
      </main>
    </div>
  );
}

export default App;