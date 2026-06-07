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
    token: string;
  } | null;
}

export default class FamilyTree extends React.Component<{}, State> {
  cont = React.createRef<HTMLDivElement>();
  toastTimeout: any = null;
  recaptchaWidgetId: any = null;

  state: State = {
    editMode: false,
    toast: null,
    captcha: null
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

  triggerSubmitFlow = (action: 'edit' | 'add' | 'delete', datum: any, updatedData: any) => {
    this.setState({
      captcha: {
        action,
        datum,
        updatedData,
        token: ''
      }
    });
  };

  handleCaptchaCancel = () => {
    this.setState({ captcha: null });
    this.recaptchaWidgetId = null;
  };

  handleCaptchaSubmit = () => {
    const { captcha } = this.state;
    if (!captcha) return;
    if (!captcha.token) {
      this.showToast('Please complete the CAPTCHA first', 'error');
      return;
    }
    const { action, datum, updatedData, token } = captcha;
    this.setState({ captcha: null }, () => {
      this.submitRequest(action, datum, updatedData, token);
    });
  };

  submitRequest = async (
    action: 'edit' | 'add' | 'delete',
    datum: any,
    updatedData: any,
    captchaToken: string
  ) => {
    this.showToast('Submitting request for approval...', 'loading');
    try {
      const response = await fetch('/api/submit-edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, datum, updatedData, captchaToken })
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
        
        // Apply local changes so the user sees it in the browser
        applyChanges();
        const updatedData = f3EditTree.exportData();
        postSubmit();

        const isExisting = familyData.some(d => d.id === datum.id);
        const action = isExisting ? 'edit' : 'add';
        
        this.triggerSubmitFlow(action, datum, updatedData);
      });

      f3EditTree.setOnDelete((datum: any, deletePerson: any, postSubmit: any) => {
        // Apply delete locally
        deletePerson();
        const updatedData = f3EditTree.exportData();
        postSubmit();

        this.triggerSubmitFlow('delete', datum, updatedData);
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
    const { editMode, toast } = this.state;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", backgroundColor: "rgb(33,33,33)", position: "relative" }}>
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
        `}</style>
        {!editMode && (
          <div className="info-banner">
            <svg className="info-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Click on any person to see their tree</span>
          </div>
        )}
        <div className="f3" id="FamilyChart" ref={this.cont} style={{ width: "100%", height: "900px", margin: "auto", backgroundColor: "rgb(33,33,33)", color: "#fff" }}></div>
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 1000 }}>
          <button 
            className={`toggle-mode-btn ${editMode ? 'edit-active' : ''}`}
            onClick={this.toggleEditMode}
          >
            {editMode ? "Switch to View Mode" : "Switch to Edit Mode"}
          </button>
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
      </div>
    );
  }
}
