import { KEY_FIELDS } from '../config/aiKeys';

function ApiCredentialsSetup({ envKeys, apiKeys, onApiKeyChange, onContinue }) {
  const missingFields = KEY_FIELDS.filter(({ key }) => !envKeys[key]);
  const configuredCount = KEY_FIELDS.filter(({ key }) =>
    envKeys[key] || apiKeys[key]?.trim(),
  ).length;

  return (
    <div className="setup-dashboard single-column">
      <div className="setup-form focus-block step-enter">
        <div className="setup-section">
          <h2 className="animate-in">API Credentials</h2>
          <p className="setup-subtitle animate-in animate-delay-1">
            Add your API keys before configuring the draft. Keys are saved in your browser and
            never sent anywhere except the draft server when you start.
          </p>

          {missingFields.map(({ key, label, placeholder, ai }, index) => (
            <div
              key={key}
              className={`field animate-in animate-delay-${Math.min(index + 2, 6)}`}
            >
              <label>{label}</label>
              <input
                type="password"
                placeholder={placeholder}
                value={apiKeys[key]}
                onChange={(e) => onApiKeyChange(key, e.target.value)}
              />
              <span className="field-hint">Required to enable {ai} in the draft.</span>
            </div>
          ))}

          {KEY_FIELDS.filter(({ key }) => envKeys[key]).length > 0 && (
            <p className="card-note animate-in animate-delay-3">
              {KEY_FIELDS.filter(({ key }) => envKeys[key])
                .map(({ ai }) => ai)
                .join(', ')}{' '}
              {KEY_FIELDS.filter(({ key }) => envKeys[key]).length === 1 ? 'is' : 'are'} already
              configured on the server.
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn-start animate-in animate-delay-4"
          onClick={onContinue}
          disabled={configuredCount < 2}
        >
          Continue to Draft Setup
        </button>
        {configuredCount < 2 && (
          <span className="field-error animate-in animate-delay-4">
            At least 2 API keys are required to run a draft.
          </span>
        )}
      </div>
    </div>
  );
}

export default ApiCredentialsSetup;
