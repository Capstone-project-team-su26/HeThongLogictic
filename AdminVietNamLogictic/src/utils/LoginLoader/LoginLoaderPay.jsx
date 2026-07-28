import React from "react";
import "./LoginLoaderPay.css";

const LoginLoaderPay = () => {
  return (
    <div className="loader-popup">
      <div className="loader-popup-content">
        <div className="loader-custom">
            <div className="loader__bar"></div>
            <div className="loader__bar"></div>
            <div className="loader__bar"></div>
            <div className="loader__bar"></div>
            <div className="loader__bar"></div>
            <div className="loader__ball"></div>
        </div>
        <span className="Loading-text">Loading<span>.</span><span>.</span><span>.</span></span>
      </div>
    </div>
  );
};

export default LoginLoaderPay;