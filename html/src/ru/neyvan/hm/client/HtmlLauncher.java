package ru.neyvan.hm.client;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.ApplicationListener;
import com.badlogic.gdx.backends.gwt.GwtApplication;
import com.badlogic.gdx.backends.gwt.GwtApplicationConfiguration;
import com.badlogic.gdx.backends.gwt.preloader.Preloader;
import com.google.gwt.core.client.GWT;
import com.google.gwt.dom.client.Style;
import com.google.gwt.event.logical.shared.ResizeEvent;
import com.google.gwt.event.logical.shared.ResizeHandler;
import com.google.gwt.user.client.Window;
import com.google.gwt.user.client.ui.Panel;

import ru.neyvan.hm.HM;

public class HtmlLauncher extends GwtApplication {

        // USE THIS CODE FOR A FIXED SIZE APPLICATION
        // @Override
        // public GwtApplicationConfiguration getConfig () {
        //         return new GwtApplicationConfiguration(336, 672);
        // }
        // END CODE FOR FIXED SIZE APPLICATION

        // UNCOMMENT THIS CODE FOR A RESIZABLE APPLICATION
        // PADDING is to avoid scrolling in iframes, set to 20 if you have problems

        private static final int PADDING = 0;
        private GwtApplicationConfiguration cfg;
        
        @Override
        public GwtApplicationConfiguration getConfig() {
            int w = Window.getClientWidth() - PADDING;
            int h = Window.getClientHeight() - PADDING;
            cfg = new GwtApplicationConfiguration(w, h);
            Window.enableScrolling(false);
            Window.setMargin("0");
            Window.addResizeHandler(new ResizeListener());
            cfg.preferFlash = false;
            return cfg;
        }
        
        class ResizeListener implements ResizeHandler {
            @Override
            public void onResize(ResizeEvent event) {
                if (Gdx.graphics.isFullscreen()) {
                    Gdx.graphics.setFullscreenMode(Gdx.graphics.getDisplayMode());
                } else {
                    int width = event.getWidth() - PADDING;
                    int height = event.getHeight() - PADDING;
                    getRootPanel().setWidth("" + width + "px");
                    getRootPanel().setHeight("" + height + "px");
                    getApplicationListener().resize(width, height);
                    Gdx.graphics.setWindowedMode(width, height);
                }
            }
        }
        // END OF CODE FOR RESIZABLE APPLICATION

        @Override
        public ApplicationListener createApplicationListener () {
                return new HM();
        }

        @Override
        public Preloader.PreloaderCallback getPreloaderCallback() {
            return createPreloaderPanel(GWT.getHostPageBaseURL() + "preloadlogo.png");
        }

        @Override
        protected void adjustMeterPanel(Panel meterPanel, Style meterStyle) {
            meterPanel.setStyleName("gdx-meter");
            //meterPanel.addStyleName("nostripes");
            meterStyle.setProperty("backgroundColor", "#00008b");
            meterStyle.setProperty("backgroundImage", "none");
        }
}