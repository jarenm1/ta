import { type FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, Input } from '../components/ui';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [endpoint, setEndpoint] = useState('');
  const [token, setToken] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEndpoint = endpoint.trim();
    const trimmedToken = token.trim();

    if (!trimmedEndpoint || !trimmedToken) {
      setErrorMessage('Canvas endpoint and token are both required.');
      return;
    }

    login({ endpoint: trimmedEndpoint, token: trimmedToken });
    navigate('/', { replace: true });
  };

  return (
    <main className="flex h-full items-center justify-center overflow-y-auto bg-neutral-100 px-6 py-10 dark:bg-neutral-900">
      <section className="w-full max-w-md">
        <Card padding="lg" shadow="md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <span className="inline-flex rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                Canvas LMS Login
              </span>
            </div>
            <CardTitle className="mt-4">Connect your Canvas account</CardTitle>
            <CardDescription className="mt-2">
              Enter your Canvas base endpoint and API token. This app stores them locally so you stay
              signed in across restarts.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="mt-2 space-y-4" onSubmit={handleSubmit}>
              <Input
                autoComplete="url"
                error={errorMessage}
                label="Canvas endpoint"
                onChange={(event) => {
                  setEndpoint(event.target.value);
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                placeholder="https://your-school.instructure.com"
                type="url"
                value={endpoint}
              />

              <Input
                autoComplete="off"
                label="API token"
                onChange={(event) => {
                  setToken(event.target.value);
                  if (errorMessage) {
                    setErrorMessage('');
                  }
                }}
                placeholder="Paste your Canvas access token"
                type="password"
                value={token}
              />

              <Button className="w-full" size="lg" type="submit" variant="primary">
                Save and continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
