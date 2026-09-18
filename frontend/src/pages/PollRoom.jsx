import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

function PollRoom() {
  const { id } = useParams();

  const [poll, setPoll] = useState(null);
  const [results, setResults] = useState({});
  const [selectedOption, setSelectedOption] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // Get poll details and initial Redis results
  useEffect(() => {
    const loadPoll = async () => {
      try {
        const pollResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/api/polls/${id}`
        );

        const pollData = await pollResponse.json();

        if (!pollResponse.ok) {
          throw new Error(pollData.error || "Could not load poll");
        }

        setPoll(pollData.poll);

        const resultsResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/api/polls/${id}/results`
        );

        const resultsData = await resultsResponse.json();

        if (resultsResponse.ok) {
          setResults(resultsData.results || {});
        }
      } catch (error) {
        setMessage(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadPoll();
  }, [id]);

  // Listen for Redis → SSE live updates
  useEffect(() => {
    const eventSource = new EventSource(
      `${import.meta.env.VITE_API_URL}/api/polls/${id}/live`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        setResults((previousResults) => ({
          ...previousResults,
          [data.optionId]: Number(data.count),
        }));
      } catch (error) {
        console.error("Invalid live update:", error);
      }
    };

    eventSource.onerror = () => {
      console.log("Live connection interrupted");
    };

    return () => {
      eventSource.close();
    };
  }, [id]);

  // Submit vote
  const vote = async () => {
    if (!selectedOption) {
      setMessage("Please select an option.");
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/polls/${id}/vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            optionId: selectedOption,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Vote failed");
      }

      setMessage("Your vote has been recorded!");
      setSelectedOption("");
    } catch (error) {
      setMessage(error.message);
    }
  };

  const totalVotes = Object.values(results).reduce(
    (sum, count) => sum + Number(count),
    0
  );

  if (loading) {
    return <h2 style={styles.center}>Loading poll...</h2>;
  }

  if (!poll) {
    return <h2 style={styles.center}>{message || "Poll not found"}</h2>;
  }

  // Shareable poll URL
  const shareUrl = `${import.meta.env.VITE_FRONTEND_URL}/poll/${id}`;

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.liveBadge}>
          <span style={styles.dot}></span>
          LIVE
        </div>

        <h1>{poll.question}</h1>

        <p style={styles.subtitle}>
          {totalVotes} {totalVotes === 1 ? "vote" : "votes"} so far
        </p>

        <div>
          {poll.options.map((option) => {
            const count = Number(results[option.id] || 0);

            const percentage =
              totalVotes > 0
                ? Math.round((count / totalVotes) * 100)
                : 0;

            return (
              <div key={option.id} style={styles.optionContainer}>
                <label style={styles.option}>
                  <input
                    type="radio"
                    name="pollOption"
                    value={option.id}
                    checked={selectedOption === option.id}
                    onChange={(e) =>
                      setSelectedOption(e.target.value)
                    }
                    disabled={!poll.isActive}
                  />

                  <span>{option.text}</span>

                  <strong>
                    {count} ({percentage}%)
                  </strong>
                </label>

                <div style={styles.progressBackground}>
                  <div
                    style={{
                      ...styles.progress,
                      width: `${percentage}%`,
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        {poll.isActive ? (
          <button
            onClick={vote}
            style={styles.voteButton}
            disabled={!selectedOption}
          >
            Submit Vote
          </button>
        ) : (
          <div style={styles.closedBadge}>
            This poll is closed
          </div>
        )}

        {message && <p style={styles.message}>{message}</p>}

        <div style={styles.shareBox}>
          <p>Share this poll</p>

          <input
            value={shareUrl}
            readOnly
            style={styles.shareInput}
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    display: "flex",
    justifyContent: "center",
    padding: "50px 20px",
  },

  card: {
    width: "100%",
    maxWidth: "650px",
    background: "white",
    padding: "35px",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },

  center: {
    textAlign: "center",
    marginTop: "100px",
  },

  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    padding: "6px 12px",
    borderRadius: "20px",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: "12px",
    fontWeight: "700",
    marginBottom: "15px",
  },

  dot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#dc2626",
  },

  subtitle: {
    color: "#666",
    marginBottom: "30px",
  },

  optionContainer: {
    marginBottom: "20px",
  },

  option: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    cursor: "pointer",
  },

  progressBackground: {
    height: "7px",
    background: "#e5e7eb",
    borderRadius: "10px",
    marginTop: "7px",
    overflow: "hidden",
  },

  progress: {
    height: "100%",
    background: "#2563eb",
    borderRadius: "10px",
    transition: "width 0.4s ease",
  },

  voteButton: {
    width: "100%",
    padding: "13px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
    marginTop: "10px",
  },

  closedBadge: {
    width: "100%",
    boxSizing: "border-box",
    padding: "13px",
    borderRadius: "8px",
    background: "#f3f4f6",
    color: "#6b7280",
    textAlign: "center",
    fontWeight: "600",
    marginTop: "10px",
  },

  message: {
    textAlign: "center",
    color: "#2563eb",
    marginTop: "15px",
  },

  shareBox: {
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "1px solid #eee",
  },

  shareInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px",
    border: "1px solid #ddd",
    borderRadius: "8px",
  },
};

export default PollRoom;