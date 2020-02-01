package ru.neyvan.hm.actors;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.Pixmap;
import com.badlogic.gdx.graphics.Texture;
import com.badlogic.gdx.graphics.g2d.Batch;
import com.badlogic.gdx.graphics.g2d.BitmapFont;
import com.badlogic.gdx.graphics.g2d.BitmapFontCache;
import com.badlogic.gdx.graphics.g2d.GlyphLayout;
import com.badlogic.gdx.graphics.g2d.SpriteBatch;
import com.badlogic.gdx.graphics.g2d.TextureRegion;
import com.badlogic.gdx.graphics.glutils.FrameBuffer;
import com.badlogic.gdx.graphics.glutils.ShaderProgram;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.Group;
import com.badlogic.gdx.scenes.scene2d.ui.Image;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Skin;
import com.badlogic.gdx.scenes.scene2d.ui.Widget;
import com.badlogic.gdx.scenes.scene2d.utils.Drawable;
import com.badlogic.gdx.scenes.scene2d.utils.TextureRegionDrawable;
import com.badlogic.gdx.utils.Align;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.surprises.ChangeSpeedTime;
import ru.neyvan.hm.surprises.Explosion;
import ru.neyvan.hm.surprises.FullFreezing;
import ru.neyvan.hm.surprises.GiftAndTrap;
import ru.neyvan.hm.surprises.HelpSurprise;
import ru.neyvan.hm.surprises.Rotation;
import ru.neyvan.hm.surprises.ScreenEffects;
import ru.neyvan.hm.surprises.Surprise;
import ru.neyvan.hm.surprises.Transference;
import ru.neyvan.hm.surprises.WarpSurprise;

import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE0;
import static com.badlogic.gdx.graphics.GL20.GL_TEXTURE1;

/**
 * Created by AndyGo on 05.03.2018.
 */

public class TextNum extends Actor {
    private final Color tempColor = new Color();
    private final GlyphLayout layout = new GlyphLayout();
    private BitmapFontCache cache;
    private BitmapFont font;
    private Color fontColor;
    private ShaderProgram fontShader;
    private ShaderProgram transitionShader;
    private ShaderProgram burnShader;
    private ShaderProgram explosionShader;
    private ShaderProgram oldShader;
    private String text;
    private float duration, time, percent;
    private TextureRegionDrawable TRD_freezing, TRD_help,TRD_timeSpeed,TRD_timeCold,TRD_explosion,TRD_warp,
            TRD_heart,TRD_present,TRD_removeLife,TRD_removeScore,TRD_colorMusic,TRD_blackAndWhite,TRD_moving,TRD_rotation;
  //  private float maxWidth, maxHeight;
    private boolean transition, burn, explosion;
    private Texture nextSymbol, currentSymbol;
    private SpriteBatch minBatch;

    public TextNum(String text, Color fontColor, float maxWidth, float maxHeight) {
        this.text = text;
        this.fontColor = fontColor;
  //     this.maxWidth = maxWidth;
   //     this.maxHeight = maxHeight;
        TRD_freezing = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("freezing"));
        TRD_help = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("help"));
        TRD_timeSpeed = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("timeSpeed"));
        TRD_timeCold = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("timeCold"));
        TRD_explosion = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("explosion"));
        TRD_warp = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("warp"));
        TRD_heart = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("heart"));
        TRD_present = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("present"));
        TRD_removeLife = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("removeLife"));
        TRD_removeScore = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("removeScore"));
        TRD_colorMusic = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("colorMusic"));
        TRD_blackAndWhite = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("blackAndWhite"));
        TRD_moving = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("moving"));
        TRD_rotation = new TextureRegionDrawable(HM.game.texture.atlas.findRegion("rotation"));
        minBatch = new SpriteBatch();
        font = HM.game.texture.numberFont;
        cache = font.getCache();
        layout.setText(font, text);
        fontShader = HM.game.shader.getFontShader();
        explosionShader = HM.game.shader.getExplosionShader();
        setText(text);
        setSize(maxWidth, maxHeight);
    }

    @Override
    protected void sizeChanged() {
//        font.getData().setScale(oldScale*scale);
//        layout.setText(font, text, fontColor, , Align.center, false);
//        centerX = (getWidth() - layout.width);
//        centerY = (getHeight() - layout.height);
        font.getData().setScale(1f);
        layout.setText(font, text);

        float scale = (0.6f*getHeight())/layout.height;
        if(scale*layout.width > 0.6f*getWidth()) scale = (0.6f*getWidth()) / layout.width;

        font.getData().setScale(scale);

        layout.setText(font, text);
        float x = (getWidth() - layout.width)/2;
        float y = layout.height+(getHeight() - layout.height)/1.6f;

        cache.setText(layout, x, y);

    }

    public void draw (Batch batch, float parentAlpha) {
        if(transition) {
            Gdx.gl.glActiveTexture(GL_TEXTURE1);
            nextSymbol.bind();

            Gdx.gl.glActiveTexture(GL_TEXTURE0);
            currentSymbol.bind();

            oldShader = batch.getShader();

            batch.setShader(transitionShader);
            batch.draw(currentSymbol, 0, 0, getWidth(), getHeight());
            batch.setShader(oldShader);
        }else if(burn) {

        }else if(explosion){
            Gdx.gl.glActiveTexture(GL_TEXTURE1);
            nextSymbol.bind();

            Gdx.gl.glActiveTexture(GL_TEXTURE0);
            currentSymbol.bind();

            oldShader = batch.getShader();

            batch.setShader(burnShader);
            batch.draw(currentSymbol, 0, 0, getWidth(), getHeight());
            batch.setShader(oldShader);
        }else{
            batch.draw(currentSymbol,0,0,getWidth(),getHeight());
        }
    }
    public void update(float delta){
        time -= delta;
        if(transition) {
            percent = 1.0f-(time/duration);
            transitionShader.begin();
            transitionShader.setUniformf("percent", percent);
            transitionShader.setUniformf("resolution", getWidth(), getHeight());
            transitionShader.end();

        }else if(burn) {

        }else if(explosion){

            explosionShader.begin();
            explosionShader.setUniformf("time", time);
            explosionShader.setUniformf("resolution", getWidth(), getHeight());
            explosionShader.end();
        }
        if(time <= 0){
            transition = false;
            burn = false;
            explosion = false;
        }
    }
    public void setText(String text){
        if(currentSymbol!=null) currentSymbol.dispose();
        currentSymbol = textToTexture(text);
        transition = false;
        burn = false;
        explosion = false;
    }
    public void setSurprise(Surprise surprise){
        if(currentSymbol!=null) currentSymbol.dispose();
        currentSymbol = drawableToTexture(surprise);
        transition = false;
        burn = false;
        explosion = false;
    }
    public void setTransition(String nextText, float duration){
        transition = true;
        time = this.duration = duration;
        nextSymbol.dispose();
        nextSymbol = textToTexture(nextText);
    }
    public void setTransition(Surprise nextSurprise, float duration){
        transition = true;
        time = this.duration = duration;
        nextSymbol.dispose();
        nextSymbol = drawableToTexture(nextSurprise);
    }

    private Texture textToTexture(String text){
        this.text = text;
        sizeChanged();
        FrameBuffer Fbo = new FrameBuffer(Pixmap.Format.RGB888, (int)(getWidth()), (int)(getHeight()), false);
        Fbo.begin();
        minBatch.begin();
        Color color = tempColor.set(getColor());
        if (fontColor != null) color.mul(fontColor);
        minBatch.setShader(fontShader);
        cache.tint(color);
        cache.setPosition(getX(), getY());
        cache.draw(minBatch);
        minBatch.setShader(null);
        minBatch.end();
        Fbo.end();
        return Fbo.getColorBufferTexture();
    }
    private Texture drawableToTexture(Surprise surprise){
        TextureRegionDrawable nextDrawable=null;
        if(surprise instanceof FullFreezing){
            nextDrawable = TRD_freezing;
        }else if(surprise instanceof HelpSurprise){
            nextDrawable = TRD_help;
        }else if(surprise instanceof ChangeSpeedTime){
            if(((ChangeSpeedTime)(surprise)).getMultiplierTime()>1.0f){
                nextDrawable = TRD_timeSpeed;
            }else{
                nextDrawable = TRD_timeCold;
            }

        }else if(surprise instanceof Explosion){
            nextDrawable = TRD_explosion;
        }else if(surprise instanceof WarpSurprise){
            nextDrawable = TRD_warp;
        }else if(surprise instanceof GiftAndTrap){
            switch (((GiftAndTrap)(surprise)).getType()){
                case GiftAndTrap.SUPER_LIFE:
                    nextDrawable = TRD_heart;
                    break;
                case GiftAndTrap.SUPER_SCORE:
                    nextDrawable = TRD_present;
                    break;
                case GiftAndTrap.DEBUF_LIFE:
                    nextDrawable = TRD_removeLife;
                    break;
                case GiftAndTrap.DEBUF_SCORE:
                    nextDrawable = TRD_removeScore;
                    break;

            }

        }else if(surprise instanceof ScreenEffects){
            switch (((ScreenEffects)(surprise)).getType()){
                case ScreenEffects.COLOR_MUSIC:
                    nextDrawable = TRD_colorMusic;
                    break;
                case ScreenEffects.INVERSION:
                    nextDrawable = TRD_blackAndWhite;
                    break;
            }
        }else if(surprise instanceof Transference){
            nextDrawable = TRD_moving;
        }else if(surprise instanceof Rotation){
            nextDrawable = TRD_rotation;
        }
        return nextDrawable.getRegion().getTexture();
    }
    public void dispose(){
        minBatch.dispose();
        nextSymbol.dispose();
        currentSymbol.dispose();
    }
}
