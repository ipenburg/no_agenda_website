<?php

namespace App\Crawling;

use App\Entity\Episode;
use Psr\Log\LoggerAwareTrait;
use Psr\Log\NullLogger;
use Symfony\Component\Routing\RouterInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;
use function Sentry\captureException;

class NotificationPublisher
{
    use LoggerAwareTrait;

    public function __construct(
        private HttpClientInterface $mastodonClient,
        private RouterInterface $router,
        private ?string $mastodonAccessToken,
        private bool $mastodonPublish,
    ) {
        $this->logger = new NullLogger();
    }

    public function publish(Episode $episode): void
    {
        if (!$this->mastodonAccessToken) {
            $this->logger->info('Mastodon access token not found. Skipping publishing of episode notification.');

            return;
        }

        if (!$this->mastodonPublish) {
            $this->logger->info('Publishing of episode notifications has been disabled.');

            return;
        }

        try {
            $code = $episode->getCode();
            $title = sprintf('No Agenda Episode %s - %s', $code, $episode->getName());
            $path = $this->router->generate('player', ['episode' => $code], RouterInterface::ABSOLUTE_URL);

            $response = $this->mastodonClient->request('POST', 'statuses', [
                'body' => http_build_query([
                    'status' => "$title $path",
                ]),
            ]);

            if (200 !== $statusCode = $response->getStatusCode()) {
                $this->logger->warning(sprintf('Failed to publish episode notification to Mastodon. Response code: %s', $statusCode));
            }
        } catch (\Throwable $exception) {
            $this->logger->critical('Failed to publish episode on Mastodon.', ['exception' => $exception]);

            captureException($exception);
        }
    }
}
