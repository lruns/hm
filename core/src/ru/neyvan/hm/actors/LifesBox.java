package ru.neyvan.hm.actors;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.BitmapFont;
import com.badlogic.gdx.graphics.g2d.BitmapFontCache;
import com.badlogic.gdx.graphics.g2d.GlyphLayout;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.utils.Drawable;

import ru.neyvan.hm.HM;

/**
 * Created by AndyGo on 11.03.2018.
 */

public class LifesBox extends Actor {
    private int lifes;
    private Skin skin;
    private final GlyphLayout layout = new GlyphLayout();
    private BitmapFontCache cache;
    private BitmapFont font;
    private Color color;
    private Color fontColor;
    private final Color tempColor = new Color();
    private boolean dead;
    private boolean fewLifes;
    private Drawable heartDraw;
    private float[][] posHeart = new float[3][2];
    private float sizeHeart;
    private String text;

    public LifesBox(Skin skin) {
        this.skin = skin;
        heartDraw = skin.getDrawable("heart");
        font = skin.getFont("title32");
        cache = font.getCache();

    }

    public void changeDrawingLifes() {
        dead = false;
        fewLifes = false;
        switch (lifes) {
            case 0:
                dead = true;
                text = HM.game.bundle.get("dead");
                layout.setText(font, text);
                float x = (getWidth() - layout.width) / 2;
                float y = layout.height + (getHeight() - layout.height) / 2;
                cache.setText(layout, x, y);
                break;
            case 1:
            case 2:
            case 3:
                fewLifes = true;
                sizeHeart = getWidth() / 3;
                if (sizeHeart > getHeight()) {
                    sizeHeart = getHeight();
                }
                float x0 = (getWidth() - sizeHeart * 3) / 2;
                float y0 = (getHeight() - sizeHeart) / 2;
                for (int i = 0; i < lifes; i++) {
                    posHeart[i][0] = x0 + i * sizeHeart;
                    posHeart[i][1] = y0;
                }
                break;
            default:
                text = lifes + "X";
                layout.setText(font, text);
                sizeHeart = getHeight();
                float x2 = (getWidth() - layout.width - sizeHeart) / 2;
                float y2;
                if (sizeHeart > layout.height) {
                    y2 = (getHeight() - sizeHeart) / 2;
                } else {
                    y2 = (getHeight() - layout.height) / 2;
                }
                cache.setText(layout, x2 + sizeHeart, layout.height + y2);
                posHeart[0][0] = x2;
                posHeart[0][1] = y2;
                break;
        }
    }

    private int i;
    private float xx;
    private float yy;

    @Override
    public void draw(Batch batch, float parentAlpha) {
        super.draw(batch, parentAlpha);
        color = tempColor.set(getColor());
        color.a *= parentAlpha;
        xx = getX();
        yy = getY();
        if (dead) {
            if (fontColor != null) color.mul(fontColor);
            cache.tint(color);
            cache.setPosition(xx, yy);
            cache.draw(batch);
        } else if (fewLifes) {
            for (i = 0; i < lifes; i++) {
                heartDraw.draw(batch, xx + posHeart[i][0], yy + posHeart[i][1], sizeHeart, sizeHeart);
            }
        } else {
            heartDraw.draw(batch, xx + posHeart[0][0], yy + posHeart[0][1], sizeHeart, sizeHeart);
            if (fontColor != null) color.mul(fontColor);
            cache.tint(color);
            cache.setPosition(xx, yy);
            cache.draw(batch);
        }
    }

    public void setLifes(int lifes) {
        this.lifes = lifes;
        sizeChanged();
    }

    public int getLifes() {
        return lifes;
    }

    @Override
    protected void sizeChanged() {
        changeDrawingLifes();
    }
}
