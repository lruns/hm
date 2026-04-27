package ru.neyvan.hm.actors;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.graphics.GL20;
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
import com.badlogic.gdx.math.Matrix4;
import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.utils.ScreenUtils;

import ru.neyvan.hm.HM;
import ru.neyvan.hm.game.Symbol;
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

public class SymbolText extends Actor {
    private final Color tempColor = new Color();
    private final GlyphLayout layout = new GlyphLayout();
    private BitmapFontCache cache;
    private BitmapFont font;
    private Color fontColor;
    private ShaderProgram fontShader;
    private ShaderProgram transitionShader;
 //   private ShaderProgram burnShader;
 //   private ShaderProgram explosionShader;
    private ShaderProgram oldShader;
    private String text;
    private float duration, time, percent;
    private TextureRegion TRD_freezing, TRD_help,TRD_timeSpeed,TRD_timeCold,TRD_explosion,TRD_warp,
            TRD_heart,TRD_present,TRD_removeLife,TRD_removeScore,TRD_colorMusic,TRD_blackAndWhite,TRD_moving,TRD_rotation;
  //  private float maxWidth, maxHeight;
    private boolean transition, burn, explosion;
    private TextureRegion nextTextureRegion, currentTextureRegion;
    private SpriteBatch minBatch;
    private float padding = 10f;
    private float symbolWidth, symbolHeight;
    Pixmap pm;
    FrameBuffer frameBuffer;
    Matrix4 normalProjection;

    private float maxTime;
    private float currentTime;

    public SymbolText(String text, Color fontColor, float maxWidth, float maxHeight) {
        this.text = text;
        this.fontColor = fontColor;
  //     this.maxWidth = maxWidth;
   //     this.maxHeight = maxHeight;
        TRD_freezing = HM.game.texture.atlas.findRegion("freezing");
        TRD_help = HM.game.texture.atlas.findRegion("help");
        TRD_timeSpeed = HM.game.texture.atlas.findRegion("timeSpeed");
        TRD_timeCold = HM.game.texture.atlas.findRegion("timeCold");
        TRD_explosion = HM.game.texture.atlas.findRegion("explosion");
        TRD_warp = HM.game.texture.atlas.findRegion("warp");
        TRD_heart = HM.game.texture.atlas.findRegion("heart");
        TRD_present = HM.game.texture.atlas.findRegion("present");
        TRD_removeLife = HM.game.texture.atlas.findRegion("removeLife");
        TRD_removeScore = HM.game.texture.atlas.findRegion("removeScore");
        TRD_colorMusic = HM.game.texture.atlas.findRegion("colorMusic");
        TRD_blackAndWhite = HM.game.texture.atlas.findRegion("blackAndWhite");
        TRD_moving = HM.game.texture.atlas.findRegion("moving");
        TRD_rotation = HM.game.texture.atlas.findRegion("rotation");
        minBatch = new SpriteBatch();
        font = HM.game.texture.numberFont;
        cache = font.getCache();
        layout.setText(font, text);
        fontShader = HM.game.shader.getFontShader();
        transitionShader = HM.game.shader.getFontTransitionShader();
 //       explosionShader = HM.game.shader.getExplosionShader();

        setSize(maxWidth, maxHeight);
        //setSymbol(null);
    }


    // set symbol without transition (for begin)
    public void setSymbol(Symbol symbol) {
        //symbol = new Symbol(new ChangeSpeedTime(0, 2));
        if(currentTextureRegion != null)currentTextureRegion.getTexture().dispose();
        if(symbol == null){
            currentTextureRegion = textToTexture(null, Color.WHITE);
        }else {
            if(symbol.isSurprise()){
                currentTextureRegion = drawableToTexture(symbol.getSurpise());
            }else{
                currentTextureRegion = textToTexture(Integer.toString(symbol.getNumber()), Color.WHITE);
            }
        }
    }

    // set symbol with transition
    public void setSymbol(Symbol symbol, float duration){
        //symbol = new Symbol(new Explosion());
        if(currentTextureRegion == null) setSymbol(null);
        transition = true;
        maxTime = time = this.duration = duration;
        currentTime = 0;
        if(nextTextureRegion != null) nextTextureRegion.getTexture().dispose();
        if(symbol == null){
            nextTextureRegion = textToTexture(null, Color.WHITE);
        }else{
            if(symbol.isSurprise()){
                nextTextureRegion = drawableToTexture(symbol.getSurpise());
            }else{
                nextTextureRegion = textToTexture(Integer.toString(symbol.getNumber()), Color.WHITE);
            }
        }
    }

    public void draw (Batch batch, float parentAlpha) {
        padding = getWidth()*0.15f;
        if(currentTextureRegion == null) return;
        if(transition) {
            batch.end();
            batch.flush();
            oldShader = batch.getShader();

            batch.begin();
            batch.setShader(transitionShader);
            batch.draw(currentTextureRegion, padding, padding, getWidth()-2*padding, getHeight()-2*padding);
            batch.setShader(oldShader);
            batch.end();

            batch.begin();
        }else if(burn) {

//        }else if(explosion){
//            Gdx.gl.glActiveTexture(GL_TEXTURE1);
//            nextTextureRegion.getTexture().bind();
//
//            Gdx.gl.glActiveTexture(GL_TEXTURE0);
//            currentTextureRegion.getTexture().bind();
//
//
//
//            oldShader = batch.getShader();
//
//            batch.setShader(burnShader);
//            batch.draw(currentTextureRegion, padding, padding, getWidth()-2*padding, getHeight()-2*padding);
//            batch.setShader(oldShader);
        }else{
            batch.draw(currentTextureRegion, padding, padding, getWidth()-2*padding, getHeight()-2*padding);
            //batch.draw(currentTextureRegion, 0, 0, getWidth(), getHeight());
        }
    }
    @Override
    public void act(float delta){
        time -= delta;
        if(transition) {
            currentTime += delta;
            percent = currentTime / maxTime;

            Gdx.gl.glActiveTexture(GL_TEXTURE1);
            nextTextureRegion.getTexture().bind();

            Gdx.gl.glActiveTexture(GL_TEXTURE0);
            currentTextureRegion.getTexture().bind();

            transitionShader.begin();
            transitionShader.setUniformi("u_texture1", 1);
            transitionShader.setUniformf("percent", percent);
            //transitionShader.setUniformf("time", currentTime);
            transitionShader.end();


            if (time <= 0) {
                currentTextureRegion = nextTextureRegion;
                nextTextureRegion = null;
                currentTime = 0;
                transition = false;
                burn = false;
                explosion = false;
            }
        }
//        }else if(burn) {
//
//        }else if(explosion){
//            explosionShader.begin();
//            explosionShader.setUniformf("time", time);
//            explosionShader.setUniformf("resolution", getWidth(), getHeight());
//            explosionShader.end();
//        }

    }

    private TextureRegion textToTexture(String text, Color fg_color){
        if(text == null) text = " ";
        float width = getWidth();
        float height = getHeight();

        font.getData().setScale(1);
        layout.setText(font, text);

        float scale = 0.9f * height / layout.height;
        if(scale * layout.width > 0.9f * width) scale = 0.9f * width / layout.width;

        font.getData().setScale(scale);

        layout.setText(font, text);
        float x = (width - layout.width) / 2;
        float y = height - (height-1.2f*layout.height)/2;

        cache.setText(layout, x, y);

        frameBuffer = new FrameBuffer(Pixmap.Format.RGBA8888, (int) width, (int) height, false);
        frameBuffer.begin();

        Gdx.gl.glClearColor(1,1,1,0);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        normalProjection = new Matrix4().setToOrtho2D(0, 0, width,  height);
        minBatch.setProjectionMatrix(normalProjection);

        minBatch.begin();
        minBatch.setColor(fg_color);
        minBatch.setShader(fontShader);

        //do some drawing ***here's where you draw your dynamic texture***
        cache.tint(fg_color);
        cache.setPosition(0, 0);
        cache.draw(minBatch);
        minBatch.setShader(null);
        minBatch.end();//finish write to buffer


        pm = ScreenUtils.getFrameBufferPixmap(0, 0, (int) width, (int) height); //write frame buffer to Pixmap
        frameBuffer.end();

        if(getStage() != null) getStage().getViewport().apply();

        TextureRegion region = new TextureRegion(new Texture(pm));
        region.flip(false, true);

//        if(disposedTexture != null) disposedTexture.getTexture().dispose();
//        frameBuffer.dispose();
        pm.dispose();

        return region;
    }
    private TextureRegion drawableToTexture(Surprise surprise){
        TextureRegion nextRegion = null;
        if(surprise instanceof FullFreezing){
            nextRegion = TRD_freezing;
        }else if(surprise instanceof HelpSurprise){
            nextRegion = TRD_help;
        }else if(surprise instanceof ChangeSpeedTime){
            if(((ChangeSpeedTime)(surprise)).getMultiplierTime()>1.0f){
                nextRegion = TRD_timeSpeed;
            }else{
                nextRegion = TRD_timeCold;
            }

        }else if(surprise instanceof Explosion){
            nextRegion = TRD_explosion;
        }else if(surprise instanceof WarpSurprise){
            nextRegion = TRD_warp;
        }else if(surprise instanceof GiftAndTrap){
            switch (((GiftAndTrap)(surprise)).getType()){
                case GiftAndTrap.SUPER_LIFE:
                    nextRegion = TRD_heart;
                    break;
                case GiftAndTrap.SUPER_SCORE:
                    nextRegion = TRD_present;
                    break;
                case GiftAndTrap.DEBUF_LIFE:
                    nextRegion = TRD_removeLife;
                    break;
                case GiftAndTrap.DEBUF_SCORE:
                    nextRegion = TRD_removeScore;
                    break;

            }

        }else if(surprise instanceof ScreenEffects){
            switch (((ScreenEffects)(surprise)).getType()){
                case ScreenEffects.COLOR_MUSIC:
                    nextRegion = TRD_colorMusic;
                    break;
                case ScreenEffects.INVERSION:
                    nextRegion = TRD_blackAndWhite;
                    break;
            }
        }else if(surprise instanceof Transference){
            nextRegion = TRD_moving;
        }else if(surprise instanceof Rotation){
            nextRegion = TRD_rotation;
        }


        float width = getWidth();
        float height = getHeight();

        frameBuffer = new FrameBuffer(Pixmap.Format.RGBA8888, (int) width, (int) height, false);

        frameBuffer.begin();
        Gdx.gl.glClearColor(1,1,1,0);
        Gdx.gl.glClear(GL20.GL_COLOR_BUFFER_BIT);
        normalProjection = new Matrix4().setToOrtho2D(0, 0, width,  height);
        minBatch.setProjectionMatrix(normalProjection);

        minBatch.begin();
        minBatch.draw(nextRegion, 0, 0, width, height);
        minBatch.end();//finish write to buffer

        pm = ScreenUtils.getFrameBufferPixmap(0, 0, (int) width, (int) height); //write frame buffer to Pixmap
        frameBuffer.end();

        TextureRegion region = new TextureRegion(new Texture(pm));
        region.flip(false, true);

//        if(disposedTexture != null) disposedTexture.getTexture().dispose();
        if(getStage() != null) getStage().getViewport().apply();
        frameBuffer.dispose();
        pm.dispose();

        return region;
    }
    public void dispose(){
        minBatch.dispose();
        // Danger! Not uncomment - you can destroy all atlas when dispose surprise
        // You ,ust solve problem!
        if(currentTextureRegion != null) currentTextureRegion.getTexture().dispose();
        if(nextTextureRegion != null) nextTextureRegion.getTexture().dispose();
    }
}
