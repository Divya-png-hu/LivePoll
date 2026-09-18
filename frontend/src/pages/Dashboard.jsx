import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const navigate = useNavigate();

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const [polls, setPolls] = useState([]);
  const [loadingPolls, setLoadingPolls] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  // Load creator's polls
  useEffect(() => {
    const fetchMyPolls = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/polls/my`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Could not load polls"
          );
        }

        setPolls(data.polls || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingPolls(false);
      }
    };

    if (token) {
      fetchMyPolls();
    }
  }, [token]);

  // Add option
  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  // Remove option
  const removeOption = (index) => {
    if (options.length > 2) {
      setOptions(
        options.filter((_, i) => i !== index)
      );
    }
  };

  // Update option
  const updateOption = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index] = value;
    setOptions(updatedOptions);
  };

  // Create poll
  const createPoll = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    const cleanQuestion = question.trim();

    const cleanOptions = options
      .map((option) => option.trim())
      .filter((option) => option !== "");

    if (!cleanQuestion) {
      setError("Please enter a question.");
      return;
    }

    if (cleanOptions.length < 2) {
      setError("Please provide at least 2 options.");
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/polls`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question: cleanQuestion,
            options: cleanOptions,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not create poll"
        );
      }

      setMessage("Poll created successfully!");

      setQuestion("");
      setOptions(["", ""]);

      // Add newly created poll to the list
      if (data.poll) {
        setPolls((previousPolls) => [
          data.poll,
          ...previousPolls,
        ]);

        setTimeout(() => {
          navigate(`/poll/${data.poll.id}`);
        }, 500);
      }

    } catch (err) {
      setError(err.message);
    }
  };

  // Close poll
  const closePoll = async (pollId) => {
    const confirmed = window.confirm(
      "Are you sure you want to close this poll?"
    );

    if (!confirmed) {
      return;
    }

    // Clear old messages
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/polls/${pollId}/close`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Read response as text first
      const responseText = await response.text();

      console.log(
        "Close poll response:",
        responseText
      );

      let data = {};

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(
          "Backend returned an invalid response: " +
            responseText
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error || "Could not close poll"
        );
      }

      // Update poll status in the UI
      setPolls((previousPolls) =>
        previousPolls.map((poll) =>
          poll.id === pollId
            ? { ...poll, isActive: false }
            : poll
        )
      );

      setMessage("Poll closed successfully!");

    } catch (err) {
      setError(err.message);
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  return (
    <div style={styles.page}>

      {/* HEADER */}
      <div style={styles.header}>

        <div>
          <h1 style={styles.title}>
            LivePoll
          </h1>

          <p style={styles.subtitle}>
            Welcome, {user.name || "User"} 👋
          </p>
        </div>

        <button
          onClick={logout}
          style={styles.logoutButton}
        >
          Logout
        </button>

      </div>

      <div style={styles.container}>

        {/* CREATE POLL */}
        <div style={styles.card}>

          <h2>Create a New Poll</h2>

          <form onSubmit={createPoll}>

            <label style={styles.label}>
              Question
            </label>

            <input
              type="text"
              placeholder="What should we learn next?"
              value={question}
              onChange={(e) =>
                setQuestion(e.target.value)
              }
              style={styles.input}
            />

            <label style={styles.label}>
              Options
            </label>

            {options.map((option, index) => (

              <div
                key={index}
                style={styles.optionRow}
              >

                <input
                  type="text"
                  placeholder={`Option ${index + 1}`}
                  value={option}
                  onChange={(e) =>
                    updateOption(
                      index,
                      e.target.value
                    )
                  }
                  style={styles.input}
                />

                {options.length > 2 && (

                  <button
                    type="button"
                    onClick={() =>
                      removeOption(index)
                    }
                    style={styles.removeButton}
                  >
                    ✕
                  </button>

                )}

              </div>

            ))}

            {options.length < 6 && (

              <button
                type="button"
                onClick={addOption}
                style={styles.secondaryButton}
              >
                + Add Option
              </button>

            )}

            <button
              type="submit"
              style={styles.primaryButton}
            >
              Create Poll
            </button>

            {message && (
              <p style={styles.success}>
                {message}
              </p>
            )}

            {error && (
              <p style={styles.error}>
                {error}
              </p>
            )}

          </form>

        </div>

        {/* MY POLLS */}
        <div style={styles.card}>

          <h2>My Polls</h2>

          {loadingPolls ? (

            <p>
              Loading your polls...
            </p>

          ) : polls.length === 0 ? (

            <p style={styles.empty}>
              You haven't created any polls yet.
            </p>

          ) : (

            <div>

              {polls.map((poll) => (

                <div
                  key={poll.id}
                  style={styles.pollItem}
                >

                  <div>

                    <h3 style={styles.pollQuestion}>
                      {poll.question}
                    </h3>

                    <p style={styles.pollInfo}>

                      {poll.options?.length || 0}
                      {" options • "}

                      {poll.isActive
                        ? "Active"
                        : "Closed"}

                    </p>

                  </div>

                  <div style={styles.buttonGroup}>

                    {/* Open Poll */}
                    <button
                      onClick={() =>
                        navigate(
                          `/poll/${poll.id}`
                        )
                      }
                      style={styles.openButton}
                    >
                      Open Poll
                    </button>

                    {/* Close Poll */}
                    {poll.isActive && (

                      <button
                        onClick={() =>
                          closePoll(poll.id)
                        }
                        style={styles.closeButton}
                      >
                        Close Poll
                      </button>

                    )}

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>

      </div>

    </div>
  );
}

const styles = {

  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 40px",
    background: "white",
    borderBottom: "1px solid #ddd",
  },

  title: {
    margin: 0,
    fontSize: "28px",
  },

  subtitle: {
    margin: "5px 0 0",
    color: "#666",
  },

  logoutButton: {
    padding: "10px 18px",
    border: "none",
    borderRadius: "8px",
    background: "#222",
    color: "white",
    cursor: "pointer",
  },

  container: {
    maxWidth: "900px",
    margin: "30px auto",
    padding: "0 20px",
  },

  card: {
    background: "white",
    padding: "25px",
    marginBottom: "25px",
    borderRadius: "12px",
    boxShadow:
      "0 2px 10px rgba(0,0,0,0.06)",
  },

  label: {
    display: "block",
    marginTop: "15px",
    marginBottom: "6px",
    fontWeight: "600",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    fontSize: "15px",
  },

  optionRow: {
    display: "flex",
    gap: "8px",
    marginBottom: "10px",
  },

  removeButton: {
    border: "none",
    background: "#eee",
    borderRadius: "8px",
    padding: "0 12px",
    cursor: "pointer",
  },

  primaryButton: {
    width: "100%",
    marginTop: "20px",
    padding: "13px",
    border: "none",
    borderRadius: "8px",
    background: "#111",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
  },

  secondaryButton: {
    marginTop: "5px",
    padding: "10px 15px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    background: "white",
    cursor: "pointer",
  },

  success: {
    color: "green",
    marginTop: "12px",
  },

  error: {
    color: "red",
    marginTop: "12px",
  },

  empty: {
    color: "#777",
  },

  pollItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    padding: "15px 0",
    borderBottom: "1px solid #eee",
  },

  pollQuestion: {
    margin: 0,
  },

  pollInfo: {
    color: "#777",
    fontSize: "14px",
  },

  buttonGroup: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
  },

  openButton: {
    padding: "9px 15px",
    border: "none",
    borderRadius: "7px",
    background: "#eee",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  closeButton: {
    padding: "9px 15px",
    border: "none",
    borderRadius: "7px",
    background: "#eee",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
};

export default Dashboard;