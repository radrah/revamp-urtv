package nz.radwan.navylauncher;

import android.service.notification.NotificationListenerService;

/** Lets Navy Home read the TV's notifications so the quick panel can show them. */
public class NotifService extends NotificationListenerService {
    static volatile NotifService inst;
    @Override public void onListenerConnected() { inst = this; }
    @Override public void onListenerDisconnected() { inst = null; }
}
