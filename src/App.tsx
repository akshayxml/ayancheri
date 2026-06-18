import React from "react";
import * as f3 from 'family-chart';  // npm install family-chart@0.9.0 or yarn add family-chart@0.9.0
import 'family-chart/styles/family-chart.css';
import "./App.css";
import { familyData } from "./data";

interface State {
  editMode: boolean;
  toast: {
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'loading';
  } | null;
  captcha: {
    action: 'edit' | 'add' | 'delete';
    datum: any;
    updatedData: any;
    originalData: any;
    token: string;
  } | null;
  searchTerm: string;
  showSearchResults: boolean;
  showDisclaimer: boolean;
}

export default class FamilyTree extends React.Component<{}, State> {
  cont = React.createRef<HTMLDivElement>();
  toastTimeout: any = null;
  recaptchaWidgetId: any = null;

  state: State = {
    editMode: false,
    toast: null,
    captcha: null,
    searchTerm: '',
    showSearchResults: false,
    showDisclaimer: true
  };

  showToast = (message: string, type: 'success' | 'error' | 'loading' = 'success', duration = 5000) => {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.setState({ toast: { show: true, message, type } });
    if (type !== 'loading') {
      this.toastTimeout = setTimeout(() => {
        this.setState({ toast: null });
        this.toastTimeout = null;
      }, duration);
    }
  };

  triggerSubmitFlow = (action: 'edit' | 'add' | 'delete', datum: any, updatedData: any, originalData: any) => {
    this.setState({
      captcha: {
        action,
        datum,
        updatedData,
        originalData,
        token: ''
      }
    });
  };

  handleCaptchaCancel = () => {
    this.setState({ captcha: null });
    this.recaptchaWidgetId = null;
  };

  handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ searchTerm: e.target.value, showSearchResults: true });
  };

  handleSearchSelect = (datum: any) => {
    this.setState({ searchTerm: "", showSearchResults: false });
    if ((window as any).f3Chart) {
      (window as any).f3Chart.updateMainId(datum.id).updateTree({ tree_position: 'main_to_middle' });
    }
  };

  getSearchResults = () => {
    const term = this.state.searchTerm.toLowerCase().trim();
    if (!term) return [];
    return familyData.filter((d: any) => {
      const name = `${d.data['first name'] || ''} ${d.data['last name'] || ''}`.toLowerCase();
      return name.includes(term);
    }).slice(0, 10);
  };

  handleCaptchaSubmit = () => {
    const { captcha } = this.state;
    if (!captcha) return;
    if (!captcha.token) {
      this.showToast('Please complete the CAPTCHA first', 'error');
      return;
    }
    const { action, datum, updatedData, originalData, token } = captcha;
    this.setState({ captcha: null }, () => {
      this.submitRequest(action, datum, updatedData, originalData, token);
    });
  };

  closeDisclaimer = () => {
    this.setState({ showDisclaimer: false });
  };

  submitRequest = async (
    action: 'edit' | 'add' | 'delete',
    datum: any,
    updatedData: any,
    originalData: any,
    captchaToken: string
  ) => {
    this.showToast('Submitting request for approval...', 'loading');
    try {
      const response = await fetch('/api/submit-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, datum, updatedData, originalData, captchaToken })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        this.showToast('Edit submitted! The owner has been notified.', 'success');
      } else {
        throw new Error(data.error || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error(error);
      this.showToast(error.message || 'Submission failed. Please try again.', 'error');
    }
  };

  componentDidMount() {
    this.renderTree();
  }

  componentDidUpdate(_prevProps: any, prevState: State) {
    if (prevState.editMode !== this.state.editMode) {
      this.renderTree();
    }

    if (!prevState.captcha && this.state.captcha) {
      this.renderRecaptcha();
    }
  }

  renderRecaptcha() {
    setTimeout(() => {
      const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
      if ((window as any).grecaptcha) {
        this.recaptchaWidgetId = (window as any).grecaptcha.render('recaptcha-container', {
          sitekey: siteKey,
          callback: (token: string) => {
            this.setState(prevState => ({
              captcha: prevState.captcha ? { ...prevState.captcha, token } : null
            }));
          },
          'expired-callback': () => {
            this.setState(prevState => ({
              captcha: prevState.captcha ? { ...prevState.captcha, token: '' } : null
            }));
          }
        });
      }
    }, 100);
  }

  renderTree() {
    if (!this.cont.current) return;
    
    // Clear the container DOM before re-rendering the chart
    this.cont.current.innerHTML = "";

    const { editMode } = this.state;
    const f3Chart = f3.createChart('#FamilyChart', familyData as any);
    (window as any).f3Chart = f3Chart;

    f3Chart
      .setTransitionTime(1000)
      .setCardXSpacing(250)
      .setCardYSpacing(150)
      .setShowSiblingsOfMain(false)
      .setOrientationVertical();

    if (editMode) {
      f3Chart.setSingleParentEmptyCard(true, { label: 'ADD' });

      const f3Card = f3Chart.setCardHtml()
        .setCardDisplay([["first name", "last name", "avatar"], ["birthday"]])
        .resetCardDim()
        .setMiniTree(true)
        .setStyle('imageRect')
        .setOnHoverPathToMain();

      const f3EditTree = f3Chart.editTree()
        .fixed()
        .setFields(["first name", "last name", "birthday", "avatar"])
        .setEditFirst(true)
        .setCardClickOpen(f3Card);

      f3EditTree.setOnSubmit((e: any, datum: any, applyChanges: any, postSubmit: any) => {
        e.preventDefault();
        
        const originalData = f3EditTree.exportData();
        // Apply local changes so the user sees it in the browser
        applyChanges();
        const updatedData = f3EditTree.exportData();
        postSubmit();

        const isExisting = familyData.some(d => d.id === datum.id);
        const action = isExisting ? 'edit' : 'add';
        
        this.triggerSubmitFlow(action, datum, updatedData, originalData);
      });

      f3EditTree.setOnDelete((datum: any, deletePerson: any, postSubmit: any) => {
        const originalData = f3EditTree.exportData();
        // Apply delete locally
        deletePerson();
        const updatedData = f3EditTree.exportData();
        postSubmit();

        this.triggerSubmitFlow('delete', datum, updatedData, originalData);
      });

      f3EditTree.setEdit();

      f3Chart.updateTree({ initial: true });
      f3EditTree.open(f3Chart.getMainDatum());
    } else {
      f3Chart.setSingleParentEmptyCard(false);

      f3Chart.setCardHtml()
        .setCardDisplay([["first name", "last name", "avatar"], ["birthday"]])
        .resetCardDim()
        .setMiniTree(true)
        .setStyle('imageRect')
        .setOnHoverPathToMain()
        .setOnCardClick((_e: any, d: any) => {
          f3Chart.updateMainId(d.data.id).updateTree({ tree_position: 'main_to_middle' });
        });

      f3Chart.updateTree({ initial: true }).updateTree({ tree_position: 'main_to_middle', scale: 0.6 });
    }
  }

  toggleEditMode = () => {
    this.setState(prevState => ({
      editMode: !prevState.editMode
    }));
  };

  render() {
    const { editMode, toast, searchTerm, showSearchResults } = this.state;
    const searchResults = this.getSearchResults();
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgb(33,33,33)", overflow: "hidden" }}>
        <style>{`
          .toggle-mode-btn {
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 15px;
            font-weight: 600;
            letter-spacing: 0.5px;
            color: #ffffff;
            background: linear-gradient(135deg, #aa3bff 0%, #7a1bcf 100%);
            border: none;
            border-radius: 8px;
            padding: 12px 28px;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(170, 59, 255, 0.4);
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            outline: none;
          }
          .toggle-mode-btn:hover {
            background: linear-gradient(135deg, #b85eff 0%, #8b2ee0 100%);
            box-shadow: 0 6px 20px rgba(170, 59, 255, 0.6);
            transform: translateY(-2px);
          }
          .toggle-mode-btn:active {
            transform: translateY(1px);
            box-shadow: 0 3px 10px rgba(170, 59, 255, 0.3);
          }
          .toggle-mode-btn.edit-active {
            background: linear-gradient(135deg, #ff4b4b 0%, #c53030 100%);
            box-shadow: 0 4px 15px rgba(255, 75, 75, 0.4);
          }
          .toggle-mode-btn.edit-active:hover {
            background: linear-gradient(135deg, #ff6b6b 0%, #e53e3e 100%);
            box-shadow: 0 6px 20px rgba(255, 75, 75, 0.6);
          }
          .search-container {
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 1000;
            width: 300px;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .search-input {
            width: 100%;
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(40, 40, 40, 0.9);
            color: white;
            font-size: 15px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
            outline: none;
            transition: all 0.3s ease;
            box-sizing: border-box;
          }
          .search-input:focus {
            border-color: #aa3bff;
            box-shadow: 0 4px 20px rgba(170, 59, 255, 0.3);
          }
          .search-input::placeholder {
            color: rgba(255, 255, 255, 0.5);
          }
          .search-results {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            margin-top: 8px;
            background: rgba(40, 40, 40, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            max-height: 300px;
            overflow-y: auto;
            backdrop-filter: blur(10px);
          }
          .search-result-item {
            padding: 12px 16px;
            cursor: pointer;
            color: white;
            transition: background 0.2s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }
          .search-result-item:last-child {
            border-bottom: none;
          }
          .search-result-item:hover {
            background: rgba(170, 59, 255, 0.2);
          }
          .search-result-name {
            font-weight: 500;
          }
          .search-result-date {
            font-size: 12px;
            color: rgba(255, 255, 255, 0.5);
          }
          @media (max-width: 768px) {
            .search-container {
              width: calc(100% - 40px);
              top: 20px;
              right: 20px;
            }
          }
        `}</style>

        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={this.handleSearchChange}
            onFocus={() => this.setState({ showSearchResults: true })}
          />
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((d: any) => (
                <div
                  key={d.id}
                  className="search-result-item"
                  onClick={() => this.handleSearchSelect(d)}
                >
                  <div className="search-result-name">
                    {d.data['first name']} {d.data['last name']}
                  </div>
                  {d.data.birthday && (
                    <div className="search-result-date">{d.data.birthday}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {!editMode && (
          <div className="info-banner">
            <svg className="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Click on any person to see their tree</span>
          </div>
        )}
        <div className="f3" id="FamilyChart" ref={this.cont} style={{ width: "100%", height: "calc(100% - 80px)", backgroundColor: "rgb(33,33,33)", color: "#fff" }}></div>
        <div style={{ width: "100%", height: "80px", display: "flex", justifyContent: "center", alignItems: "center", position: "relative", backgroundColor: "rgba(20,20,25,0.8)", borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 1000 }}>
          <button 
            className={`toggle-mode-btn ${editMode ? 'edit-active' : ''}`}
            onClick={this.toggleEditMode}
          >
            {editMode ? "Switch to View Mode" : "Switch to Edit Mode"}
          </button>

          <a
            href="https://github.com/akshayxml/ayancheri"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: "absolute",
              right: "24px",
              color: "white",
              opacity: 0.6,
              transition: "opacity 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            title="View on GitHub"
          >
            <svg height="32" viewBox="0 0 16 16" version="1.1" width="32" fill="currentColor">
              <path fillRule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
          </a>
        </div>

        {toast && (
          <div className={`notification-toast show ${toast.type}`}>
            {toast.type === 'loading' && <div className="spinner" />}
            {toast.type === 'success' && (
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {this.state.captcha && (
          <div className="captcha-overlay">
            <div className="captcha-modal">
              <h3>Security Verification</h3>
              <p>Please check the box below to verify you are human:</p>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
                <div id="recaptcha-container"></div>
              </div>
              <div className="captcha-actions">
                <button className="cancel-btn" onClick={this.handleCaptchaCancel}>Cancel</button>
                <button 
                  className="submit-btn" 
                  onClick={this.handleCaptchaSubmit}
                  disabled={!this.state.captcha.token}
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        )}

        {this.state.showDisclaimer && (
          <div className="captcha-overlay">
            <div className="captcha-modal" style={{ textAlign: "center", maxWidth: "400px" }}>
              <h3 style={{ marginBottom: "15px", color: "#aa3bff" }}>Notice</h3>
              <p style={{ lineHeight: "1.6", marginBottom: "20px", fontSize: "15px", color: "#e0e0e0" }}>
                This family tree is incomplete.<br />
                Please help complete it if you or someone you know is missing.<br /><br />
                ഈ ഫാമിലി ട്രീ അപൂർണ്ണമാണ്.<br />
                നിങ്ങളോ നിങ്ങൾക്ക് അറിയാവുന്നവരോ വിട്ടുപോയിട്ടുണ്ടെങ്കിൽ ദയവായി ഇത് പൂർത്തിയാക്കാൻ സഹായിക്കുക.
              </p>
              <button
                className="submit-btn"
                style={{ width: "100%", padding: "12px", marginTop: "10px" }}
                onClick={this.closeDisclaimer}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
}
