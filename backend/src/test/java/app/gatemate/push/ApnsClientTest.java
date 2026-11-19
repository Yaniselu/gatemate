package app.gatemate.push;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ApnsClientTest {
    @Test
    void classifiesApnsResponses() {
        assertThat(ApnsClient.classify(200, "")).isEqualTo(ApnsClient.Result.SENT);
        assertThat(ApnsClient.classify(410, "{\"reason\":\"Unregistered\"}")).isEqualTo(ApnsClient.Result.GONE);
        assertThat(ApnsClient.classify(400, "{\"reason\":\"BadDeviceToken\"}")).isEqualTo(ApnsClient.Result.WRONG_ENVIRONMENT);
        assertThat(ApnsClient.classify(400, "{\"reason\":\"DeviceTokenNotForTopic\"}")).isEqualTo(ApnsClient.Result.GONE);
        assertThat(ApnsClient.classify(429, "{\"reason\":\"TooManyRequests\"}")).isEqualTo(ApnsClient.Result.FAILED);
    }

    @Test
    void respectsMutedKinds() {
        var t = new PushTokenEntity();
        assertThat(t.wants("gate")).isTrue();
        t.muted = "gate,delay";
        assertThat(t.wants("gate")).isFalse();
        assertThat(t.wants("delay")).isFalse();
        assertThat(t.wants("boarding")).isTrue();
    }
}
