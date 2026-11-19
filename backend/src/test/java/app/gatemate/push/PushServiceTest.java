package app.gatemate.push;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.Test;

class PushServiceTest {
    private final PushTokenEntity.Repo repo = mock(PushTokenEntity.Repo.class);
    private final ApnsClient apns = mock(ApnsClient.class);
    private final PushService push = new PushService(repo, apns);

    private PushTokenEntity token(String env) {
        var t = new PushTokenEntity();
        t.token = "abc";
        t.platform = "ios";
        t.apnsEnv = env;
        return t;
    }

    @Test
    void fallsBackToSandboxAndRemembersIt() {
        when(apns.enabled()).thenReturn(true);
        when(apns.send(eq(ApnsClient.PRODUCTION), any(), any(), any(), any())).thenReturn(ApnsClient.Result.WRONG_ENVIRONMENT);
        when(apns.send(eq(ApnsClient.SANDBOX), any(), any(), any(), any())).thenReturn(ApnsClient.Result.SENT);
        var t = token(null);
        push.deliver(t, "Gate B12", "Your gate changed", "f1");
        verify(repo).save(t);
        org.assertj.core.api.Assertions.assertThat(t.apnsEnv).isEqualTo("sandbox");
    }

    @Test
    void removesDeadTokens() {
        when(apns.enabled()).thenReturn(true);
        when(apns.send(any(), any(), any(), any(), any())).thenReturn(ApnsClient.Result.GONE);
        push.deliver(token("prod"), "t", "b", null);
        verify(repo).deleteById("abc");
    }

    @Test
    void skipsAndroidAndUnconfigured() {
        var a = token(null);
        a.platform = "android";
        push.deliver(a, "t", "b", null);
        when(apns.enabled()).thenReturn(false);
        push.deliver(token(null), "t", "b", null);
        verify(apns, never()).send(any(), any(), any(), any(), any());
    }
}
